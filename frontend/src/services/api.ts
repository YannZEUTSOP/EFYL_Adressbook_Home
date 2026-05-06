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
  verified: boolean;
  flag_count: number;
  created_at: string;
};

export const Api = {
  health: () => request<{ status: string }>('/health'),
  listAddresses: (ownerId = 'guest', q?: string) =>
    request<AddressDTO[]>(
      `/addresses?owner_id=${encodeURIComponent(ownerId)}${q ? `&q=${encodeURIComponent(q)}` : ''}`
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
    request<{ sent: boolean; demo_code: string }>('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  otpVerify: (phone: string, code: string) =>
    request<{ verified: boolean; user_id: string; phone: string }>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),
};
