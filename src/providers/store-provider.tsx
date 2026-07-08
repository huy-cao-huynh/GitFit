import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  buildSeedCheckoffLog,
  buildSeedSessions,
  buildSeedSteps,
  seedBodyweight,
  seedCheckoffDefs,
  seedGoals,
  seedRoutines,
} from '@/lib/store/seed';
import { loadJSON, saveJSON, saveJSONAsync, StorageKeys } from '@/lib/store/storage';
import type {
  BodyweightEntry,
  CheckoffDef,
  CheckoffLog,
  Goals,
  Routine,
  Session,
  StepsEntry,
} from '@/lib/store/types';

interface StoreData {
  routines: Routine[];
  sessions: Session[];
  goals: Goals;
  checkoffDefs: CheckoffDef[];
  checkoffLog: CheckoffLog;
  bodyweight: BodyweightEntry[];
  steps: StepsEntry[];
}

interface StoreValue extends StoreData {
  isHydrated: boolean;
  addRoutine: (routine: Routine) => void;
  updateRoutine: (routine: Routine) => void;
  deleteRoutine: (id: string) => void;
  addSession: (session: Session) => void;
  setGoals: (goals: Goals) => void;
  setCheckoffDefs: (defs: CheckoffDef[]) => void;
  toggleCheckoff: (date: string, defId: string) => void;
  addBodyweight: (entry: BodyweightEntry) => void;
}

const EMPTY: StoreData = {
  routines: [],
  sessions: [],
  goals: seedGoals,
  checkoffDefs: [],
  checkoffLog: {},
  bodyweight: [],
  steps: [],
};

const StoreContext = createContext<StoreValue | null>(null);

function buildSeedData(): StoreData {
  const sessions = buildSeedSessions();
  return {
    routines: seedRoutines,
    sessions,
    goals: seedGoals,
    checkoffDefs: seedCheckoffDefs,
    checkoffLog: buildSeedCheckoffLog(sessions),
    bodyweight: seedBodyweight,
    steps: buildSeedSteps(),
  };
}

export function StoreProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<StoreData | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const seeded = await loadJSON<boolean>(StorageKeys.seeded);
      if (!seeded) {
        const initial = buildSeedData();
        await Promise.all(
          (Object.keys(initial) as (keyof StoreData)[]).map((key) =>
            saveJSONAsync(StorageKeys[key], initial[key]),
          ),
        );
        // Written after the data so a crash mid-seed retries next launch.
        await saveJSONAsync(StorageKeys.seeded, true);
        if (!cancelled) setData(initial);
        return;
      }

      const [routines, sessions, goals, checkoffDefs, checkoffLog, bodyweight, steps] =
        await Promise.all([
          loadJSON<Routine[]>(StorageKeys.routines),
          loadJSON<Session[]>(StorageKeys.sessions),
          loadJSON<Goals>(StorageKeys.goals),
          loadJSON<CheckoffDef[]>(StorageKeys.checkoffDefs),
          loadJSON<CheckoffLog>(StorageKeys.checkoffLog),
          loadJSON<BodyweightEntry[]>(StorageKeys.bodyweight),
          loadJSON<StepsEntry[]>(StorageKeys.steps),
        ]);
      if (cancelled) return;
      setData({
        routines: routines ?? [],
        sessions: sessions ?? [],
        goals: goals ?? seedGoals,
        checkoffDefs: checkoffDefs ?? [],
        checkoffLog: checkoffLog ?? {},
        bodyweight: bodyweight ?? [],
        steps: steps ?? [],
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const apply = useCallback(
    <K extends keyof StoreData>(key: K, updater: (current: StoreData[K]) => StoreData[K]) => {
      setData((previous) => {
        if (!previous) return previous;
        const nextValue = updater(previous[key]);
        saveJSON(StorageKeys[key], nextValue);
        return { ...previous, [key]: nextValue };
      });
    },
    [],
  );

  const value = useMemo<StoreValue>(
    () => ({
      ...(data ?? EMPTY),
      isHydrated: data !== null,
      addRoutine: (routine) => apply('routines', (routines) => [...routines, routine]),
      updateRoutine: (routine) =>
        apply('routines', (routines) => routines.map((r) => (r.id === routine.id ? routine : r))),
      deleteRoutine: (id) => apply('routines', (routines) => routines.filter((r) => r.id !== id)),
      addSession: (session) => apply('sessions', (sessions) => [session, ...sessions]),
      setGoals: (goals) => apply('goals', () => goals),
      setCheckoffDefs: (defs) => apply('checkoffDefs', () => defs),
      toggleCheckoff: (date, defId) =>
        apply('checkoffLog', (log) => {
          const day = log[date] ?? [];
          const next = day.includes(defId) ? day.filter((id) => id !== defId) : [...day, defId];
          return { ...log, [date]: next };
        }),
      addBodyweight: (entry) => apply('bodyweight', (entries) => [...entries, entry]),
    }),
    [data, apply],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used within StoreProvider');
  return store;
}
