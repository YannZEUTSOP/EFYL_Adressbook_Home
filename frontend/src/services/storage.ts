import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AddressDTO } from './api';
import type { HouseholdSurvey } from '../types/survey';

const KEYS = {
  addresses: 'efyl:addresses',
  syncQueue: 'efyl:sync_queue',
  surveyQueue: 'efyl:survey_queue',
  surveys: 'efyl:surveys',
  surveyDrafts: 'efyl:survey_drafts',
  flags: 'efyl:flags',
  user: 'efyl:user',
  prefs: 'efyl:prefs',
  onboarded: 'efyl:onboarded',
  lastSync: 'efyl:last_sync',
  deviceId: 'efyl:device_id',
};

export type SyncOp = {
  id: string;
  op: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Partial<AddressDTO>;
  createdAt: string;
};

export type SurveySyncOp = {
  id: string;
  op: 'UPSERT' | 'DELETE';
  payload: HouseholdSurvey | { address_id: string };
  createdAt: string;
};

export type Prefs = {
  language: 'fr' | 'en';
  surveyorName?: string;
};

export type SurveyDraft = {
  survey: HouseholdSurvey;
  stepKey: string;
  savedAt: string;
};

export type UserState = {
  loggedIn: boolean;
  phone?: string;
  userId?: string;
};

async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function setJSON(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const Storage = {
  getAddresses: () => getJSON<AddressDTO[]>(KEYS.addresses, []),
  setAddresses: (list: AddressDTO[]) => setJSON(KEYS.addresses, list),
  upsertAddress: async (a: AddressDTO) => {
    const list = await getJSON<AddressDTO[]>(KEYS.addresses, []);
    const idx = list.findIndex((x) => x.address_id === a.address_id);
    if (idx >= 0) list[idx] = a;
    else list.unshift(a);
    await setJSON(KEYS.addresses, list);
    return list;
  },
  removeAddress: async (addressId: string) => {
    const list = await getJSON<AddressDTO[]>(KEYS.addresses, []);
    const next = list.filter((x) => x.address_id !== addressId);
    await setJSON(KEYS.addresses, next);
    return next;
  },

  // address sync queue
  getSyncQueue: () => getJSON<SyncOp[]>(KEYS.syncQueue, []),
  enqueueSync: async (op: SyncOp) => {
    const q = await getJSON<SyncOp[]>(KEYS.syncQueue, []);
    q.push(op);
    await setJSON(KEYS.syncQueue, q);
    return q;
  },
  setSyncQueue: (q: SyncOp[]) => setJSON(KEYS.syncQueue, q),

  // survey local cache + queue
  getSurveys: () => getJSON<Record<string, HouseholdSurvey>>(KEYS.surveys, {}),
  upsertSurvey: async (s: HouseholdSurvey) => {
    const map = await getJSON<Record<string, HouseholdSurvey>>(KEYS.surveys, {});
    map[s.address_id] = s;
    await setJSON(KEYS.surveys, map);
  },
  removeSurvey: async (addressId: string) => {
    const map = await getJSON<Record<string, HouseholdSurvey>>(KEYS.surveys, {});
    delete map[addressId];
    await setJSON(KEYS.surveys, map);
  },
  getSurveyQueue: () => getJSON<SurveySyncOp[]>(KEYS.surveyQueue, []),
  enqueueSurveySync: async (op: SurveySyncOp) => {
    const q = await getJSON<SurveySyncOp[]>(KEYS.surveyQueue, []);
    q.push(op);
    await setJSON(KEYS.surveyQueue, q);
    return q;
  },
  setSurveyQueue: (q: SurveySyncOp[]) => setJSON(KEYS.surveyQueue, q),

  // survey drafts (phase-1 / resume later)
  getSurveyDraft: async (addressId: string): Promise<SurveyDraft | null> => {
    const map = await getJSON<Record<string, SurveyDraft>>(KEYS.surveyDrafts, {});
    return map[addressId] || null;
  },
  setSurveyDraft: async (addressId: string, draft: SurveyDraft) => {
    const map = await getJSON<Record<string, SurveyDraft>>(KEYS.surveyDrafts, {});
    map[addressId] = draft;
    await setJSON(KEYS.surveyDrafts, map);
  },
  removeSurveyDraft: async (addressId: string) => {
    const map = await getJSON<Record<string, SurveyDraft>>(KEYS.surveyDrafts, {});
    delete map[addressId];
    await setJSON(KEYS.surveyDrafts, map);
  },

  // stable per-device identity (used to track which tester created what)
  getDeviceId: async (): Promise<string> => {
    let id = await AsyncStorage.getItem(KEYS.deviceId);
    if (!id) {
      id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      await AsyncStorage.setItem(KEYS.deviceId, id);
    }
    return id;
  },

  // sync timestamps
  setLastSync: (ts: string) => AsyncStorage.setItem(KEYS.lastSync, ts),
  getLastSync: () => AsyncStorage.getItem(KEYS.lastSync),

  // prefs
  getPrefs: () => getJSON<Prefs>(KEYS.prefs, { language: 'fr' }),
  setPrefs: (p: Prefs) => setJSON(KEYS.prefs, p),

  // user
  getUser: () => getJSON<UserState>(KEYS.user, { loggedIn: false }),
  setUser: (u: UserState) => setJSON(KEYS.user, u),

  // onboarding
  isOnboarded: async () => (await AsyncStorage.getItem(KEYS.onboarded)) === '1',
  markOnboarded: () => AsyncStorage.setItem(KEYS.onboarded, '1'),
  resetOnboarded: () => AsyncStorage.removeItem(KEYS.onboarded),

  clearAll: async () => {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  },
};

export const StorageKeys = KEYS;
