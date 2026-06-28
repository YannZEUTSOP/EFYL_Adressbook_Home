// District code map (Douala)
const DISTRICT_CODES: Record<string, string> = {
  Bonamoussadi: 'BNA',
  Akwa: 'AKW',
  Makepe: 'MKP',
  Bonaberi: 'BNB',
  Deido: 'DEI',
  Bali: 'BAL',
  Bonapriso: 'BNP',
  Logbessou: 'LGB',
  PK14: 'PK14',
};

export function districtCode(district: string): string {
  if (!district) return 'XXX';
  if (DISTRICT_CODES[district]) return DISTRICT_CODES[district];
  // fallback: first 3 uppercased
  return district.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'XXX';
}

function pad3(s: string): string {
  const n = (s || '').replace(/\D/g, '');
  return n.padStart(3, '0').slice(-3);
}

export function buildAddressId(
  district: string,
  sector: string,
  streetId: string,
  houseNumber: string,
): string {
  const d = districtCode(district);
  const s = (sector || 'X').slice(0, 2).toUpperCase();
  return `${d}-${s}${pad3(streetId)}-X${pad3(houseNumber)}`;
}

export function formatAddressDisplay(district: string, sector: string, streetId: string, houseNumber: string): string {
  return `${district} - ${(sector || '').toUpperCase()} ${pad3(streetId)} X ${pad3(houseNumber)}`;
}

export function deepLinkFor(addressId: string): string {
  return `efyladdress://import?id=${encodeURIComponent(addressId)}`;
}

export function shareMessageFor(name: string, addressId: string, lang: 'fr' | 'en' = 'fr', appUrl?: string): string {
  const base = appUrl || (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BACKEND_URL) || '';
  const link = `${base}/import?id=${encodeURIComponent(addressId)}`;
  if (lang === 'fr') {
    return `📍 ${name || 'Mon adresse'}\nAdresse: ${addressId}\nOuvrir dans EFYL AddressBook: ${link}`;
  }
  return `📍 ${name || 'My address'}\nAddress: ${addressId}\nOpen in EFYL AddressBook: ${link}`;
}

export function buildQRPayload(addr: {
  address_id: string;
  district: string;
  sector: string;
  street_id: string;
  house_number: string;
  latitude: number;
  longitude: number;
  contact_name?: string;
}): string {
  return JSON.stringify({
    v: 1,
    aid: addr.address_id,
    d: addr.district,
    s: addr.sector,
    st: addr.street_id,
    h: addr.house_number,
    lt: Number(addr.latitude.toFixed(6)),
    lg: Number(addr.longitude.toFixed(6)),
    n: addr.contact_name || '',
  });
}

export type DecodedQR = {
  v?: number;
  aid: string;
  d: string;
  s: string;
  st: string;
  h: string;
  lt: number;
  lg: number;
  n?: string;
};

export function tryDecodeQR(raw: string): DecodedQR | null {
  try {
    const obj = JSON.parse(raw);
    if (obj && obj.aid && typeof obj.lt === 'number' && typeof obj.lg === 'number') {
      return obj as DecodedQR;
    }
  } catch {
    // ignore
  }
  // attempt deep-link parse
  const m = raw.match(/[?&]id=([^&\s]+)/);
  if (m) {
    return {
      aid: decodeURIComponent(m[1]),
      d: '',
      s: '',
      st: '',
      h: '',
      lt: 0,
      lg: 0,
    };
  }
  return null;
}
