// EFYL — Dedicated photo storage, kept OUT of AsyncStorage/localStorage.
// AsyncStorage (web localStorage ≈ 5 MB, Android ≈ 6 MB) saturates quickly with
// base64 photos — this was the root cause of the field "quota exceeded" crash.
//   Web    → IndexedDB (hundreds of MB allowed by browsers)
//   Native → one JSON file per address via expo-file-system (no practical limit)
import { Platform } from 'react-native';
import type { AddressPhoto } from './api';

const DB_NAME = 'efyl_photos';
const STORE = 'photos';

// ---------- Web: IndexedDB (with in-memory fallback) ----------
const memoryFallback = new Map<string, AddressPhoto[]>();
const hasIDB = Platform.OS === 'web' && typeof indexedDB !== 'undefined';

let dbPromise: Promise<IDBDatabase> | null = null;
function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function idbGet(key: string): Promise<AddressPhoto[] | null> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve((req.result as AddressPhoto[]) || null);
        req.onerror = () => reject(req.error);
      })
  );
}

function idbSet(key: string, value: AddressPhoto[]): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function idbDelete(key: string): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

// ---------- Native: one JSON file per address ----------
let FS: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    FS = require('expo-file-system/legacy');
  } catch {
    FS = null;
  }
}
const dirUri = () => `${FS.documentDirectory}efyl_photos/`;
const fileUri = (addressId: string) =>
  `${dirUri()}${encodeURIComponent(addressId)}.json`;

async function ensureDir(): Promise<void> {
  try {
    await FS.makeDirectoryAsync(dirUri(), { intermediates: true });
  } catch {
    /* already exists */
  }
}

export const PhotoStore = {
  async getPhotos(addressId: string): Promise<AddressPhoto[]> {
    try {
      if (Platform.OS === 'web') {
        if (!hasIDB) return memoryFallback.get(addressId) || [];
        return (await idbGet(addressId)) || [];
      }
      if (!FS) return memoryFallback.get(addressId) || [];
      const info = await FS.getInfoAsync(fileUri(addressId));
      if (!info.exists) return [];
      const raw = await FS.readAsStringAsync(fileUri(addressId));
      return JSON.parse(raw) as AddressPhoto[];
    } catch {
      return [];
    }
  },

  async setPhotos(addressId: string, photos: AddressPhoto[]): Promise<void> {
    if (!photos.length) {
      await PhotoStore.deletePhotos(addressId);
      return;
    }
    if (Platform.OS === 'web') {
      if (!hasIDB) {
        memoryFallback.set(addressId, photos);
        return;
      }
      await idbSet(addressId, photos);
      return;
    }
    if (!FS) {
      memoryFallback.set(addressId, photos);
      return;
    }
    await ensureDir();
    await FS.writeAsStringAsync(fileUri(addressId), JSON.stringify(photos));
  },

  async deletePhotos(addressId: string): Promise<void> {
    try {
      memoryFallback.delete(addressId);
      if (Platform.OS === 'web') {
        if (hasIDB) await idbDelete(addressId);
        return;
      }
      if (FS) await FS.deleteAsync(fileUri(addressId), { idempotent: true });
    } catch {
      /* best effort */
    }
  },
};
