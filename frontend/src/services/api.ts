import type { HouseholdSurvey } from '../types/survey';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export type AuthUser = {
  user_id: string;
  efyl_id: string;
  name: string;
  phone: string;
  token: string;
};

export type AddressPhoto = {
  base64: string;
  lat: number | null;
  lng: number | null;
  bearing: number | null;   // compass direction of the camera when the photo was taken
  taken_at: string;
};

export type AddressDTO = {
  id: string;
  address_id: string;
  district: string;
  sector: string;
  street_id: string;
  house_number: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  contact_name?: string;
  contact_phone?: string;
  notes?: string;
  owner_id?: string;
  owner_name?: string;   // surveyor display name (tracking)
  verified: boolean;
  flag_count: number;
  low_accuracy?: boolean;
  azimuth_degrees?: number | null;
  photo_base64?: string | null;
  photos?: AddressPhoto[] | null;
  photos_count?: number | null;
  lat_raw?: number | null;
  lng_raw?: number | null;
  lat_corrected?: number | null;
  lng_corrected?: number | null;
  has_survey?: boolean;
  is_commerce?: boolean;
  is_public?: boolean;
  is_heritage?: boolean;
  created_at: string;
};

export type DirectoryCategory = 'household' | 'commerce' | 'public' | 'heritage';

export type DirectoryEntry = {
  key: string;            // immutable record id (address codes are NOT unique)
  address_id: string;
  matricule: string;
  name: string;
  district: string;
  sector: string;
  street_id: string;
  house_number: string;
  category: DirectoryCategory;
  lat: number | null;
  lng: number | null;
  nav_source: 'nav_point' | 'corrected' | 'gps';
  verified: boolean;
  has_survey: boolean;
  surveyor: string;
  shared_code: boolean;   // several buildings recorded under this same code
  created_at: string;
  distance_m?: number;
};

export type DirectoryDetail = {
  key: string;
  address_id: string;
  matricule: string;
  name: string;
  category: DirectoryCategory;
  surveyor: string;
  shared_code: boolean;
  district: string;
  sector: string;
  street_id: string;
  house_number: string;
  access_hint: string;
  nav_note: string;
  azimuth_degrees: number | null;
  lat: number | null;
  lng: number | null;
  nav_source: 'nav_point' | 'corrected' | 'gps';
  accuracy_meters: number | null;
  verified: boolean;
  created_at: string;
  photo_base64: string | null;
  details: Record<string, any>;
};

export type GuestAccount = {
  user_id: string;
  guest_id: string;
  name: string;
  pin?: string;
  token: string;
  addresses_count: number;
  is_guest?: boolean;
  efyl_id?: string;
};

export type GuestCandidate = {
  ref: string;
  guest_id_masked: string;
  name: string;
  last_login: string;
  created_at: string;
  addresses_count: number;
  same_device: boolean;
  is_guest?: boolean;
};

export const Api = {
  base: () => BASE,
  health: () => request<{ status: string; twilio_enabled?: boolean }>('/health'),
  listAddresses: (ownerId = 'guest', q?: string) =>
    request<AddressDTO[]>(
      `/addresses?owner_id=${encodeURIComponent(ownerId)}${q ? `&q=${encodeURIComponent(q)}` : ''}`
    ),
  listCommerces: (q?: string) =>
    request<AddressDTO[]>(`/commerces${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  // Admin dashboard (PIN-protected)
  adminOverview: (pin: string) =>
    request<any>(`/admin/overview?pin=${encodeURIComponent(pin)}`),
  adminAddresses: (pin: string, limit = 300) =>
    request<any[]>(`/admin/addresses?pin=${encodeURIComponent(pin)}&limit=${limit}`),
  adminExportCsvUrl: (pin: string) =>
    `${BASE}/api/admin/export/csv?pin=${encodeURIComponent(pin)}`,
  adminExportEnrichedCsvUrl: (pin: string) =>
    `${BASE}/api/admin/export/csv-enriched?pin=${encodeURIComponent(pin)}`,
  adminAddressFull: (pin: string, addressId: string) =>
    request<{ address: any; survey: any }>(
      `/admin/address/${encodeURIComponent(addressId)}?pin=${encodeURIComponent(pin)}`
    ),
  getAddress: (addressId: string, ownerId = 'guest') =>
    request<AddressDTO>(`/addresses/${encodeURIComponent(addressId)}?owner_id=${encodeURIComponent(ownerId)}`),
  createAddress: (data: Partial<AddressDTO>) =>
    request<AddressDTO>('/addresses', { method: 'POST', body: JSON.stringify(data) }),
  updateAddress: (addressId: string, data: Partial<AddressDTO>, ownerId = 'guest') =>
    request<AddressDTO>(
      `/addresses/${encodeURIComponent(addressId)}?owner_id=${encodeURIComponent(ownerId)}`,
      { method: 'PUT', body: JSON.stringify(data) }
    ),
  deleteAddress: (addressId: string, ownerId = 'guest') =>
    request<{ deleted: number }>(
      `/addresses/${encodeURIComponent(addressId)}?owner_id=${encodeURIComponent(ownerId)}`,
      { method: 'DELETE' }
    ),
  syncBulk: (items: Partial<AddressDTO>[]) =>
    request<{ synced: number; timestamp: string }>('/sync', {
      method: 'POST',
      body: JSON.stringify(items),
    }),
  verify: (addressId: string, lat: number, lng: number, accuracy: number, userId = 'guest') =>
    request<{ distance_m: number; flagged: boolean; verified: boolean }>('/verify', {
      method: 'POST',
      body: JSON.stringify({
        address_id: addressId,
        submitted_lat: lat,
        submitted_lng: lng,
        submitted_accuracy: accuracy,
        user_id: userId,
      }),
    }),
  otpRequest: (phone: string) =>
    request<{ sent: boolean; method: string; demo_code?: string }>('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  otpVerify: (phone: string, code: string) =>
    request<{ verified: boolean; user_id: string; phone: string }>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),
  // Account (phone + 4-digit PIN credentials)
  register: (data: { phone: string; name: string; pin: string; code: string }) =>
    request<AuthUser>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (identifier: string, pin: string) =>
    request<AuthUser>('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, pin }) }),
  restore: (token: string) =>
    request<{ user: any; addresses: AddressDTO[]; surveys: HouseholdSurvey[] }>('/restore', {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    }),
  // Surveys
  saveSurvey: (s: HouseholdSurvey) =>
    request<HouseholdSurvey>('/surveys', { method: 'POST', body: JSON.stringify(s) }),
  getSurvey: (addressId: string, ownerId = 'guest') =>
    request<HouseholdSurvey>(`/surveys/${encodeURIComponent(addressId)}?owner_id=${encodeURIComponent(ownerId)}`),
  deleteSurvey: (addressId: string, ownerId = 'guest') =>
    request<{ deleted: number }>(`/surveys/${encodeURIComponent(addressId)}?owner_id=${encodeURIComponent(ownerId)}`, { method: 'DELETE' }),
  // Export URLs (used by Linking)
  exportCsvUrl: (ownerId?: string) =>
    `${BASE}/api/export/csv${ownerId ? `?owner_id=${encodeURIComponent(ownerId)}` : ''}`,
  exportJsonUrl: (ownerId?: string) =>
    `${BASE}/api/export/json${ownerId ? `?owner_id=${encodeURIComponent(ownerId)}` : ''}`,

  // ===== Répertoire (public directory) =====
  directorySummary: () =>
    request<{ counts: Record<DirectoryCategory, number>; total: number }>('/directory/summary'),
  directoryEntries: (opts: {
    category: DirectoryCategory; q?: string; limit?: number; offset?: number;
    lat?: number; lng?: number; sort?: 'name' | 'near' | 'recent';
  }) => {
    const p = new URLSearchParams({ category: opts.category });
    if (opts.q) p.set('q', opts.q);
    p.set('limit', String(opts.limit ?? 50));
    p.set('offset', String(opts.offset ?? 0));
    if (opts.sort) p.set('sort', opts.sort);
    if (opts.lat !== undefined && opts.lng !== undefined) {
      p.set('lat', String(opts.lat));
      p.set('lng', String(opts.lng));
    }
    return request<{ category: DirectoryCategory; total: number; offset: number; items: DirectoryEntry[] }>(
      `/directory/entries?${p.toString()}`
    );
  },
  directoryEntry: (key: string) =>
    request<DirectoryDetail>(`/directory/entry/${encodeURIComponent(key)}`),

  // ===== Guest identity (device-bound) =====
  guestDeviceCheck: (deviceHash: string, deviceLabel = '') =>
    request<{ known: boolean; accounts: GuestCandidate[] }>('/guest/device-check', {
      method: 'POST',
      body: JSON.stringify({ device_hash: deviceHash, device_label: deviceLabel }),
    }),
  guestRegister: (data: { name: string; device_hash: string; device_id: string; device_label?: string }) =>
    request<GuestAccount>('/guest/register', { method: 'POST', body: JSON.stringify(data) }),
  guestLookup: (name: string, deviceHash = '') =>
    request<{ count: number; candidates: GuestCandidate[] }>('/guest/lookup', {
      method: 'POST',
      body: JSON.stringify({ name, device_hash: deviceHash }),
    }),
  guestLogin: (data: { pin: string; ref?: string; guest_id?: string; device_hash?: string; device_label?: string }) =>
    request<GuestAccount>('/guest/login', { method: 'POST', body: JSON.stringify(data) }),

  // Admin: attach matricules / exact navigation points
  adminImportMatricules: (pin: string, csvText: string, dryRun: boolean) =>
    request<any>(`/admin/import/matricules?pin=${encodeURIComponent(pin)}`, {
      method: 'POST',
      body: JSON.stringify({ csv_text: csvText, dry_run: dryRun }),
    }),
};
