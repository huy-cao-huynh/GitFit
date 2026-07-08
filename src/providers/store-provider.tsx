import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import * as remote from '@/lib/store/remote';
import { seedGoals, seedPreferences } from '@/lib/store/seed';
import type {
  BodyweightEntry,
  CardioSession,
  CheckoffDef,
  Goals,
  MeasurementDef,
  MeasurementEntry,
  Preferences,
  Routine,
  Session,
  StoreData,
  WaterEntry,
} from '@/lib/store/types';
import { useAuth } from '@/providers/auth-provider';

interface StoreValue extends StoreData {
  isHydrated: boolean;
  addRoutine: (routine: Routine) => void;
  updateRoutine: (routine: Routine) => void;
  deleteRoutine: (id: string) => void;
  addSession: (session: Session) => void;
  addCardioSession: (session: CardioSession) => void;
  setGoals: (goals: Goals) => void;
  setCheckoffDefs: (defs: CheckoffDef[]) => void;
  toggleCheckoff: (date: string, defId: string) => void;
  addBodyweight: (entry: BodyweightEntry) => void;
  addWaterEntry: (entry: WaterEntry) => void;
  setMeasurementDefs: (defs: MeasurementDef[]) => void;
  addMeasurementEntry: (entry: MeasurementEntry) => void;
  setPreferences: (preferences: Preferences) => void;
}

const EMPTY: StoreData = {
  routines: [],
  sessions: [],
  cardioSessions: [],
  goals: seedGoals,
  checkoffDefs: [],
  checkoffLog: {},
  bodyweight: [],
  steps: [],
  waterEntries: [],
  measurementDefs: [],
  measurementEntries: [],
  preferences: seedPreferences,
};

const StoreContext = createContext<StoreValue | null>(null);

/** Fire-and-forget remote write: optimistic UI state is already updated. */
function persist(label: string, write: Promise<void>): void {
  write.catch((error) => {
    console.warn(`Failed to persist ${label} to Supabase`, error);
  });
}

/** Hydrated store tagged with its owner, so stale data never leaks across a
 * logout/login — a mismatched userId reads as "not hydrated yet". */
interface LoadedData {
  userId: string;
  data: StoreData;
}

export function StoreProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [loaded, setLoaded] = useState<LoadedData | null>(null);
  const data = loaded && loaded.userId === userId ? loaded.data : null;

  // Hydrate from Supabase whenever a user logs in.
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    (async () => {
      try {
        const fetched = await remote.fetchStoreData();
        // First login: no goals yet, so write the defaults up-front.
        if (fetched.goals.length === 0) {
          fetched.goals = seedGoals;
          persist('default goals', remote.seedDefaultGoals(seedGoals));
        }
        if (!cancelled) setLoaded({ userId, data: fetched });
      } catch (error) {
        console.warn('Failed to hydrate store from Supabase', error);
        // Unblock the UI with an empty store; writes made in this state still
        // go to Supabase and a restart re-hydrates the full dataset.
        if (!cancelled) setLoaded({ userId, data: EMPTY });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const apply = useCallback(
    <K extends keyof StoreData>(key: K, updater: (current: StoreData[K]) => StoreData[K]) => {
      setLoaded((previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          data: { ...previous.data, [key]: updater(previous.data[key]) },
        };
      });
    },
    [],
  );

  const value = useMemo<StoreValue>(
    () => ({
      ...(data ?? EMPTY),
      // Logged out there is nothing to hydrate; the auth guard shows login.
      isHydrated: userId === null || data !== null,
      addRoutine: (routine) => {
        apply('routines', (routines) => [...routines, routine]);
        persist('routine', remote.insertRoutine(routine));
      },
      updateRoutine: (routine) => {
        apply('routines', (routines) => routines.map((r) => (r.id === routine.id ? routine : r)));
        persist('routine', remote.updateRoutine(routine));
      },
      deleteRoutine: (id) => {
        apply('routines', (routines) => routines.filter((r) => r.id !== id));
        persist('routine delete', remote.deleteRoutine(id));
      },
      addSession: (session) => {
        apply('sessions', (sessions) => [session, ...sessions]);
        persist('session', remote.insertSession(session));
      },
      addCardioSession: (session) => {
        apply('cardioSessions', (cardioSessions) => [session, ...cardioSessions]);
        persist('cardio session', remote.insertCardioSession(session));
      },
      setGoals: (goals) => {
        apply('goals', () => goals);
        persist('goals', remote.setGoals(goals));
      },
      setCheckoffDefs: (defs) => {
        apply('checkoffDefs', () => defs);
        persist('check-off defs', remote.setCheckoffDefs(defs));
      },
      toggleCheckoff: (date, defId) => {
        const checked = !(data?.checkoffLog[date] ?? []).includes(defId);
        apply('checkoffLog', (log) => {
          const day = log[date] ?? [];
          const next = day.includes(defId) ? day.filter((id) => id !== defId) : [...day, defId];
          return { ...log, [date]: next };
        });
        persist('check-off', remote.setCheckoff(date, defId, checked));
      },
      addBodyweight: (entry) => {
        apply('bodyweight', (entries) =>
          [...entries.filter((existing) => existing.date !== entry.date), entry].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
        );
        persist('bodyweight', remote.upsertBodyweight(entry));
      },
      addWaterEntry: (entry) => {
        apply('waterEntries', (entries) =>
          [entry, ...entries.filter((existing) => existing.id !== entry.id)].sort((a, b) =>
            b.date.localeCompare(a.date),
          ),
        );
        persist('water entry', remote.insertWaterEntry(entry));
      },
      setMeasurementDefs: (defs) => {
        apply('measurementDefs', () => defs);
        persist('measurement defs', remote.setMeasurementDefs(defs));
      },
      addMeasurementEntry: (entry) => {
        apply('measurementEntries', (entries) =>
          [entry, ...entries.filter((existing) => existing.id !== entry.id)].sort((a, b) =>
            b.date.localeCompare(a.date),
          ),
        );
        persist('measurement entry', remote.insertMeasurementEntry(entry));
      },
      setPreferences: (preferences) => {
        apply('preferences', () => preferences);
        if (userId) persist('preferences', remote.updatePreferences(userId, preferences));
      },
    }),
    [data, apply, userId],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used within StoreProvider');
  return store;
}
