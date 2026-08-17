import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { Storage, SyncOp, SurveySyncOp, Prefs, UserState } from '../services/storage';
import { Api, AddressDTO } from '../services/api';
import { STRINGS, Lang, Strings } from '../i18n';
import { DEMO_ADDRESSES } from '../utils/demoData';
import type { HouseholdSurvey, Person } from '../types/survey';

type Ctx = {
  ready: boolean;
  language: Lang;
  setLanguage: (l: Lang) => Promise<void>;
  t: Strings;
  user: UserState;
  setUser: (u: UserState) => Promise<void>;
  deviceId: string;
  ownerId: string;
  surveyorName: string;
  setSurveyorName: (n: string) => Promise<void>;
  addresses: AddressDTO[];
  publicCommerces: AddressDTO[];
  refreshAddresses: () => Promise<void>;
  refreshPublicCommerces: () => Promise<void>;
  saveAddress: (a: AddressDTO) => Promise<void>;
  deleteAddress: (addressId: string) => Promise<void>;
  saveSurvey: (s: HouseholdSurvey) => Promise<void>;
  getLocalSurvey: (addressId: string) => Promise<HouseholdSurvey | null>;
  deleteSurvey: (addressId: string) => Promise<void>;
  removePerson: (addressId: string, index: number) => Promise<void>;
  addPerson: (addressId: string, person: Person) => Promise<void>;
  updatePerson: (addressId: string, index: number, person: Person) => Promise<void>;
  syncQueueCount: number;
  syncNow: () => Promise<{ synced: number } | null>;
  lastSync: string | null;
  isOnline: boolean;
  setOnline: (b: boolean) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [language, setLanguageState] = useState<Lang>('fr');
  const [user, setUserState] = useState<UserState>({ loggedIn: false });
  const [deviceId, setDeviceId] = useState<string>('');
  const [surveyorName, setSurveyorNameState] = useState<string>('');
  const [addresses, setAddresses] = useState<AddressDTO[]>([]);
  const [publicCommerces, setPublicCommerces] = useState<AddressDTO[]>([]);
  const [syncQueueCount, setSyncQueueCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isOnline, setOnline] = useState(true);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    (async () => {
      const [prefs, u, list, q, sq, ls, devId] = await Promise.all([
        Storage.getPrefs(),
        Storage.getUser(),
        Storage.getAddresses(),
        Storage.getSyncQueue(),
        Storage.getSurveyQueue(),
        Storage.getLastSync(),
        Storage.getDeviceId(),
      ]);
      setLanguageState(prefs.language);
      setSurveyorNameState(prefs.surveyorName || '');
      setUserState(u);
      setDeviceId(devId);
      let initialList = list;
      if (!list.length) {
        await Storage.setAddresses(DEMO_ADDRESSES);
        initialList = DEMO_ADDRESSES;
      }
      setAddresses(initialList);
      setSyncQueueCount(q.length + sq.length);
      setLastSync(ls);
      setReady(true);
    })();
  }, []);

  // NetInfo auto-sync subscription
  useEffect(() => {
    if (!ready) return;
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      setOnline(online);
      if (online && wasOfflineRef.current) {
        // Just came back online → auto-flush queue
        syncNow();
      }
      wasOfflineRef.current = !online;
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Stable identity of this surveyor: logged-in user id, else per-device guest id.
  const ownerId = useMemo(
    () => (user.loggedIn && user.userId ? user.userId : deviceId ? `guest-${deviceId}` : 'guest'),
    [user.loggedIn, user.userId, deviceId]
  );

  const setLanguage = useCallback(async (l: Lang) => {
    setLanguageState(l);
    const prefs = await Storage.getPrefs();
    await Storage.setPrefs({ ...prefs, language: l });
  }, []);

  const setSurveyorName = useCallback(async (n: string) => {
    setSurveyorNameState(n);
    const prefs = await Storage.getPrefs();
    await Storage.setPrefs({ ...prefs, surveyorName: n });
  }, []);

  const setUser = useCallback(async (u: UserState) => {
    setUserState(u);
    await Storage.setUser(u);
  }, []);

  const refreshAddresses = useCallback(async () => {
    const list = await Storage.getAddresses();
    setAddresses(list);
  }, []);

  const refreshPublicCommerces = useCallback(async () => {
    try {
      const list = await Api.listCommerces();
      setPublicCommerces(list.filter((c) => c.owner_id !== ownerId));
    } catch {
      // network down — keep current value
    }
  }, [ownerId]);

  useEffect(() => {
    if (ready) refreshPublicCommerces();
  }, [ready, refreshPublicCommerces]);

  const refreshQueueCount = useCallback(async () => {
    const [aq, sq] = await Promise.all([Storage.getSyncQueue(), Storage.getSurveyQueue()]);
    setSyncQueueCount(aq.length + sq.length);
  }, []);

  const saveAddress = useCallback(async (a: AddressDTO) => {
    const list = await Storage.upsertAddress(a);
    setAddresses(list);
    const op: SyncOp = {
      id: `${a.address_id}-${Date.now()}`,
      op: 'CREATE',
      payload: a,
      createdAt: new Date().toISOString(),
    };
    await Storage.enqueueSync(op);
    await refreshQueueCount();
  }, [refreshQueueCount]);

  const deleteAddress = useCallback(async (addressId: string) => {
    const list = await Storage.removeAddress(addressId);
    setAddresses(list);
    await Storage.removeSurvey(addressId);
    const op: SyncOp = {
      id: `${addressId}-del-${Date.now()}`,
      op: 'DELETE',
      payload: { address_id: addressId },
      createdAt: new Date().toISOString(),
    };
    await Storage.enqueueSync(op);
    await refreshQueueCount();
  }, [refreshQueueCount]);

  const saveSurvey = useCallback(async (s: HouseholdSurvey) => {
    const stamped: HouseholdSurvey = { ...s, owner_id: ownerId };
    await Storage.upsertSurvey(stamped);
    await Storage.removeSurveyDraft(s.address_id);
    const list = await Storage.getAddresses();
    const next = list.map((a) =>
      a.address_id === s.address_id
        ? {
            ...a,
            has_survey: true,
            is_commerce: s.survey_type === 'commerce',
            is_public: s.survey_type === 'public',
            is_heritage: s.survey_type === 'heritage',
          }
        : a
    );
    await Storage.setAddresses(next);
    setAddresses(next);
    const op: SurveySyncOp = {
      id: `${s.address_id}-survey-${Date.now()}`,
      op: 'UPSERT',
      payload: stamped,
      createdAt: new Date().toISOString(),
    };
    await Storage.enqueueSurveySync(op);
    await refreshQueueCount();
  }, [refreshQueueCount, ownerId]);

  const getLocalSurvey = useCallback(async (addressId: string) => {
    const map = await Storage.getSurveys();
    return map[addressId] || null;
  }, []);

  const deleteSurvey = useCallback(async (addressId: string) => {
    await Storage.removeSurvey(addressId);
    const list = await Storage.getAddresses();
    const next = list.map((a) =>
      a.address_id === addressId ? { ...a, has_survey: false } : a
    );
    await Storage.setAddresses(next);
    setAddresses(next);
    const op: SurveySyncOp = {
      id: `${addressId}-survey-del-${Date.now()}`,
      op: 'DELETE',
      payload: { address_id: addressId },
      createdAt: new Date().toISOString(),
    };
    await Storage.enqueueSurveySync(op);
    await refreshQueueCount();
  }, [refreshQueueCount]);

  // ===== Person CRUD =====
  // Internal helper: update persons list on a survey, recompute total_persons, and queue sync.
  const mutateSurveyPersons = useCallback(async (
    addressId: string,
    transform: (persons: Person[]) => Person[],
  ) => {
    const map = await Storage.getSurveys();
    const current = map[addressId];
    if (!current) throw new Error('Survey introuvable pour cette adresse');
    if (current.survey_type !== 'household') {
      throw new Error('Seules les adresses Foyer ont des habitants');
    }
    const nextPersons = transform(current.persons || []);
    const next: HouseholdSurvey = {
      ...current,
      persons: nextPersons,
      total_persons: Math.max(1, nextPersons.length),
    };
    await Storage.upsertSurvey(next);
    const op: SurveySyncOp = {
      id: `${addressId}-survey-${Date.now()}`,
      op: 'UPSERT',
      payload: next,
      createdAt: new Date().toISOString(),
    };
    await Storage.enqueueSurveySync(op);
    await refreshQueueCount();
  }, [refreshQueueCount]);

  const removePerson = useCallback(async (addressId: string, index: number) => {
    await mutateSurveyPersons(addressId, (persons) => persons.filter((_, i) => i !== index));
  }, [mutateSurveyPersons]);

  const addPerson = useCallback(async (addressId: string, person: Person) => {
    await mutateSurveyPersons(addressId, (persons) => [...persons, person]);
  }, [mutateSurveyPersons]);

  const updatePerson = useCallback(async (addressId: string, index: number, person: Person) => {
    await mutateSurveyPersons(addressId, (persons) =>
      persons.map((p, i) => (i === index ? person : p))
    );
  }, [mutateSurveyPersons]);

  const syncNow = useCallback(async () => {
    try {
      const queue = await Storage.getSyncQueue();
      const surveyQueue = await Storage.getSurveyQueue();
      const creates = queue.filter((o) => o.op !== 'DELETE').map((o) => o.payload);
      const deletes = queue.filter((o) => o.op === 'DELETE');
      let synced = 0;
      if (creates.length) {
        const r = await Api.syncBulk(creates);
        synced += r.synced;
      }
      for (const d of deletes) {
        if (d.payload.address_id) {
          try {
            await Api.deleteAddress(d.payload.address_id, ownerId);
            synced += 1;
          } catch { /* ignore individual failures */ }
        }
      }
      await Storage.setSyncQueue([]);
      // surveys — keep failed ops in the queue so no data is ever lost
      const failedSurveys: SurveySyncOp[] = [];
      for (const op of surveyQueue) {
        try {
          if (op.op === 'UPSERT' && 'address_id' in op.payload) {
            await Api.saveSurvey(op.payload as HouseholdSurvey);
          } else if (op.op === 'DELETE') {
            await Api.deleteSurvey((op.payload as { address_id: string }).address_id, ownerId);
          }
          synced += 1;
        } catch {
          failedSurveys.push(op);
        }
      }
      await Storage.setSurveyQueue(failedSurveys);
      setSyncQueueCount(failedSurveys.length);
      const ts = new Date().toISOString();
      await Storage.setLastSync(ts);
      setLastSync(ts);
      setOnline(true);
      // After sync, refresh public commerces to pull in newly added ones from others
      refreshPublicCommerces();
      return { synced };
    } catch (e) {
      setOnline(false);
      return null;
    }
  }, [ownerId]);

  // Initial flush: as soon as the app is ready (and whenever identity resolves),
  // push any data recorded offline in a previous session.
  useEffect(() => {
    if (ready && deviceId) {
      syncNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, deviceId]);

  const t = useMemo<Strings>(() => STRINGS[language], [language]);

  const value: Ctx = {
    ready, language, setLanguage, t,
    user, setUser,
    deviceId, ownerId, surveyorName, setSurveyorName,
    addresses, publicCommerces, refreshAddresses, refreshPublicCommerces,
    saveAddress, deleteAddress,
    saveSurvey, getLocalSurvey, deleteSurvey,
    removePerson, addPerson, updatePerson,
    syncQueueCount, syncNow, lastSync, isOnline, setOnline,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
};

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
