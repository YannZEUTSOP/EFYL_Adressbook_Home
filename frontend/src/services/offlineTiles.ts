// EFYL AddressBook — Offline map tiles service
// Downloads OpenStreetMap tiles to the device filesystem so the map keeps
// working without any Internet connection (offline-first).
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

export type OfflineRegion = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
  minZoom: number;
  maxZoom: number;
  tileCount: number;
  downloadedCount: number;
  sizeBytes: number;
  createdAt: string;
  status: 'complete' | 'partial';
};

export const MIN_ZOOM = 12;
export const MAX_ZOOM = 17;
export const RADIUS_OPTIONS = [2, 5, 10]; // km
const AVG_TILE_BYTES = 14 * 1024;
const REGIONS_KEY = 'efyl_offline_regions_v1';
const TILE_DIR = `${FileSystem.documentDirectory || ''}efyl_tiles/`;

export const isOfflineMapsSupported = Platform.OS !== 'web';

// Fotouni & surrounding towns first (user request), then major Cameroon cities.
export const PRESET_CITIES: { name: string; lat: number; lng: number }[] = [
  { name: 'Fotouni', lat: 5.3223, lng: 10.2272 },
  { name: 'Bafang', lat: 5.157, lng: 10.176 },
  { name: 'Bandja', lat: 5.35, lng: 10.2667 },
  { name: 'Banka', lat: 5.1667, lng: 10.2 },
  { name: 'Bana', lat: 5.1381, lng: 10.2768 },
  { name: 'Kékem', lat: 5.16, lng: 10.033 },
  { name: 'Bafoussam', lat: 5.4781, lng: 10.4179 },
  { name: 'Bangangté', lat: 5.1417, lng: 10.5225 },
  { name: 'Douala', lat: 4.0511, lng: 9.7679 },
  { name: 'Yaoundé', lat: 3.848, lng: 11.5021 },
  { name: 'Bamenda', lat: 5.9631, lng: 10.1591 },
  { name: 'Garoua', lat: 9.3265, lng: 13.3958 },
  { name: 'Maroua', lat: 10.591, lng: 14.3158 },
  { name: 'Ngaoundéré', lat: 7.3167, lng: 13.5833 },
  { name: 'Bertoua', lat: 4.5776, lng: 13.6846 },
  { name: 'Buea', lat: 4.156, lng: 9.2632 },
  { name: 'Kribi', lat: 2.9404, lng: 9.9098 },
  { name: 'Limbé', lat: 4.0186, lng: 9.2145 },
  { name: 'Ebolowa', lat: 2.9, lng: 11.15 },
];

type Tile = { z: number; x: number; y: number };

function lonToX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, z));
}
function latToY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z));
}

function tileBounds(lat: number, lng: number, radiusKm: number, z: number) {
  const dLat = radiusKm / 110.574;
  const dLng = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const xA = lonToX(lng - dLng, z);
  const xB = lonToX(lng + dLng, z);
  const yA = latToY(lat + dLat, z);
  const yB = latToY(lat - dLat, z);
  return {
    xMin: Math.min(xA, xB), xMax: Math.max(xA, xB),
    yMin: Math.min(yA, yB), yMax: Math.max(yA, yB),
  };
}

export function countTiles(lat: number, lng: number, radiusKm: number, minZoom = MIN_ZOOM, maxZoom = MAX_ZOOM): number {
  let n = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    const b = tileBounds(lat, lng, radiusKm, z);
    n += (b.xMax - b.xMin + 1) * (b.yMax - b.yMin + 1);
  }
  return n;
}

export function estimateSizeMB(tileCount: number): number {
  return (tileCount * AVG_TILE_BYTES) / (1024 * 1024);
}

function computeTiles(lat: number, lng: number, radiusKm: number, minZoom = MIN_ZOOM, maxZoom = MAX_ZOOM): Tile[] {
  const tiles: Tile[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const b = tileBounds(lat, lng, radiusKm, z);
    for (let x = b.xMin; x <= b.xMax; x++) {
      for (let y = b.yMin; y <= b.yMax; y++) {
        tiles.push({ z, x, y });
      }
    }
  }
  return tiles;
}

function tilePath(t: Tile): string {
  return `${TILE_DIR}${t.z}/${t.x}/${t.y}.png`;
}

function tileUrl(t: Tile): string {
  const sub = ['a', 'b', 'c'][(t.x + t.y) % 3];
  return `https://${sub}.tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`;
}

// ===== Region metadata =====
export async function getRegions(): Promise<OfflineRegion[]> {
  try {
    const raw = await AsyncStorage.getItem(REGIONS_KEY);
    return raw ? (JSON.parse(raw) as OfflineRegion[]) : [];
  } catch {
    return [];
  }
}

async function saveRegions(list: OfflineRegion[]): Promise<void> {
  await AsyncStorage.setItem(REGIONS_KEY, JSON.stringify(list));
}

export function totalSizeBytes(regions: OfflineRegion[]): number {
  return regions.reduce((s, r) => s + r.sizeBytes, 0);
}

// ===== Download =====
export async function downloadRegion(
  params: { name: string; lat: number; lng: number; radiusKm: number },
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<OfflineRegion> {
  const tiles = computeTiles(params.lat, params.lng, params.radiusKm);
  const total = tiles.length;
  let ok = 0;
  let failed = 0;
  let bytes = 0;
  const CONC = 6;

  for (let i = 0; i < tiles.length; i += CONC) {
    if (isCancelled()) break;
    const batch = tiles.slice(i, i + CONC);
    await Promise.all(batch.map(async (t) => {
      const path = tilePath(t);
      try {
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists && ((info as { size?: number }).size ?? 0) > 0) {
          bytes += (info as { size?: number }).size ?? AVG_TILE_BYTES;
          ok++;
          return;
        }
        await FileSystem.makeDirectoryAsync(`${TILE_DIR}${t.z}/${t.x}`, { intermediates: true }).catch(() => {});
        const res = await FileSystem.downloadAsync(tileUrl(t), path, {
          headers: { 'User-Agent': 'EFYL-AddressBook/1.0 (offline maps; contact: app)' },
        });
        if (res.status === 200) {
          const inf = await FileSystem.getInfoAsync(path);
          bytes += (inf as { size?: number }).size ?? AVG_TILE_BYTES;
          ok++;
        } else {
          failed++;
          await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
        }
      } catch {
        failed++;
      }
    }));
    onProgress(Math.min(ok + failed, total), total);
  }

  const region: OfflineRegion = {
    id: `${params.name}-${params.radiusKm}`,
    name: params.name,
    lat: params.lat,
    lng: params.lng,
    radiusKm: params.radiusKm,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    tileCount: total,
    downloadedCount: ok,
    sizeBytes: bytes,
    createdAt: new Date().toISOString(),
    status: ok >= total ? 'complete' : 'partial',
  };
  const list = await getRegions();
  await saveRegions([...list.filter((r) => r.id !== region.id), region]);
  return region;
}

// ===== Delete =====
export async function deleteRegion(id: string): Promise<void> {
  const regions = await getRegions();
  const region = regions.find((r) => r.id === id);
  if (!region) return;
  const remaining = regions.filter((r) => r.id !== id);
  if (remaining.length === 0) {
    // No other region → wipe the whole tile directory (fast)
    await FileSystem.deleteAsync(TILE_DIR, { idempotent: true }).catch(() => {});
  } else {
    const tiles = computeTiles(region.lat, region.lng, region.radiusKm, region.minZoom, region.maxZoom);
    const CONC = 24;
    for (let i = 0; i < tiles.length; i += CONC) {
      await Promise.all(
        tiles.slice(i, i + CONC).map((t) => FileSystem.deleteAsync(tilePath(t), { idempotent: true }).catch(() => {}))
      );
    }
  }
  await saveRegions(remaining);
}

// ===== Tile read (used by LeafletMap bridge when offline) =====
export async function getTileDataUrl(z: number, x: number, y: number): Promise<string | null> {
  if (!isOfflineMapsSupported) return null;
  try {
    const path = `${TILE_DIR}${z}/${x}/${y}.png`;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const b64 = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/png;base64,${b64}`;
  } catch {
    return null;
  }
}
