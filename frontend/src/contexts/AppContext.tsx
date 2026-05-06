import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { Storage, SyncOp, Prefs, UserState } from '../services/storage';
import { Api, AddressDTO } from '../services/api';
import { STRINGS, Lang, Strings } from '../i18n';
import { DEMO_ADDRESSES } from '../utils/demoData';

type Ctx = {
  ready: boolean;
  language: Lang;
  setLanguage: (l: Lang) => Promise<void>;
  t: Strings;
  user: UserState;
  setUser: (u: UserState) => Promise<void>;
  addresses: AddressDTO[];
  refreshAddresses: () => Promise<void>;
  saveAddress: (a: AddressDTO) => Promise<void>;
  deleteAddress: (addressId: string) => Promise<void>;
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
  const [addresses, setAddresses] = useState<AddressDTO[]>([]);
  const [syncQueueCount, setSyncQueueCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isOnline, setOnline] = useState(true);

  // initial load
  useEffect(() => {
    (async () => {
      const [prefs, u, list, q, ls] = await Promise.all([
        Storage.getPrefs(),
        Storage.getUser(),
        Storage.getAddresses(),
        Storage.getSyncQueue(),
        Storage.getLastSync(),
      ]);
      setLanguageState(prefs.language);
      setUserState(u);
      // Seed demo data on first run if address book empty
      let initialList = list;
      if (!list.length) {
        await Storage.setAddresses(DEMO_ADDRESSES);
        initialList = DEMO_ADDRESSES;
      }
      setAddresses(initialList);
      setSyncQueueCount(q.length);
      setLastSync(ls);
      setReady(true);
    })();
  }, []);

  const setLanguage = useCallback(async (l: Lang) => {
    setLanguageState(l);
    await Storage.setPrefs({ language: l } as Prefs);
  }, []);

  const setUser = useCallback(async (u: UserState) => {
    setUserState(u);
    await Storage.setUser(u);
  }, []);

  const refreshAddresses = useCallback(async () => {
    const list = await Storage.getAddresses();
    setAddresses(list);
  }, []);

  const saveAddress = useCallback(async (a: AddressDTO) => {
    const list = await Storage.upsertAddress(a);
    setAddresses(list);
    // queue sync
    const op: SyncOp = {
      id: `${a.address_id}-${Date.now()}`,
      op: 'CREATE',
      payload: a,
      createdAt: new Date().toISOString(),
    };
    const q = await Storage.enqueueSync(op);
    setSyncQueueCount(q.length);
  }, []);

  const deleteAddress = useCallback(async (addressId: string) => {
    const list = await Storage.removeAddress(addressId);
    setAddresses(list);
    const op: SyncOp = {
      id: `${addressId}-del-${Date.now()}`,
      op: 'DELETE',
      payload: { address_id: addressId },
      createdAt: new Date().toISOString(),
    };
    const q = await Storage.enqueueSync(op);
    setSyncQueueCount(q.length);
  }, []);

  const syncNow = useCallback(async () => {
    try {
      const queue = await Storage.getSyncQueue();
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
            await Api.deleteAddress(d.payload.address_id, user.userId || 'guest');
            synced += 1;
          } catch {
            // ignore individual failures
          }
        }
      }
      await Storage.setSyncQueue([]);
      setSyncQueueCount(0);
      const ts = new Date().toISOString();
      await Storage.setLastSync(ts);
      setLastSync(ts);
      setOnline(true);
      return { synced };
    } catch (e) {
      setOnline(false);
      return null;
    }
  }, [user.userId]);

  const t = useMemo<Strings>(() => STRINGS[language], [language]);

  const value: Ctx = {
    ready,
    language,
    setLanguage,
    t,
    user,
    setUser,
    addresses,
    refreshAddresses,
    saveAddress,
    deleteAddress,
    syncQueueCount,
    syncNow,
    lastSync,
    isOnline,
    setOnline,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
};

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
