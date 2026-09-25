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
import { isLegacyEventId } from '@/lib/store/id';
import { makeSeedGoals, seedPreferences } from '@/lib/store/seed';
import type {
  BodyweightEntry,
  CardioSession,
  CheckoffDef,
  FoodLogEntry,
  GoalEntry,
  Goals,
  MealEvent,
  MeasurementDef,
  MeasurementEntry,
  NutritionGoals,
  Preferences,
  Recipe,
  Routine,
  Session,
  StoreData,
  StravaActivityLink,
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
  updateCardioSession: (session: CardioSession) => void;
  setGoals: (goals: Goals) => void;
  addGoalEntry: (entry: GoalEntry) => void;
  setCheckoffDefs: (defs: CheckoffDef[]) => void;
  toggleCheckoff: (date: string, defId: string) => void;
  addBodyweight: (entry: BodyweightEntry) => void;
  addWaterEntry: (entry: WaterEntry) => void;
  updateWaterEntry: (entry: WaterEntry) => void;
  deleteWaterEntry: (id: string) => void;
  setMeasurementDefs: (defs: MeasurementDef[]) => void;
  addMeasurementEntry: (entry: MeasurementEntry) => void;
  /** A new timeline event plus the foods in it. */
  logMealEvent: (event: MealEvent, items: FoodLogEntry[]) => void;
  /** Appends foods to an existing event (their `eventId` must point at it). */
  addFoodLogs: (items: FoodLogEntry[]) => void;
  updateMealEvent: (event: MealEvent) => void;
  deleteMealEvent: (id: string) => void;
  updateFoodLog: (entry: FoodLogEntry) => void;
  /** Deleting an event's last food deletes the event too. */
  deleteFoodLog: (id: string) => void;
  addRecipe: (recipe: Recipe) => void;
  updateRecipe: (recipe: Recipe) => void;
  deleteRecipe: (id: string) => void;
  setNutritionGoals: (goals: NutritionGoals) => void;
  setPreferences: (preferences: Preferences) => void;
  /**
   * Mirrors a successful upload into the in-memory link list. In-memory only:
   * the strava-upload Edge Function already wrote the row server-side.
   */
  recordStravaExport: (link: StravaActivityLink) => void;
}

const EMPTY: StoreData = {
  routines: [],
  sessions: [],
  cardioSessions: [],
  goals: makeSeedGoals(),
  goalEntries: [],
  checkoffDefs: [],
  checkoffLog: {},
  bodyweight: [],
  steps: [],
  waterEntries: [],
  measurementDefs: [],
  measurementEntries: [],
  mealEvents: [],
  foodLogs: [],
  recipes: [],
  nutritionGoals: null,
  preferences: seedPreferences,
  stravaActivities: [],
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
          fetched.goals = makeSeedGoals();
          persist('default goals', remote.seedDefaultGoals(fetched.goals));
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
      recordStravaExport: (link) => {
        apply('stravaActivities', (links) => [
          link,
          ...links.filter(
            (existing) =>
              !(
                existing.direction === link.direction &&
                existing.gitfitActivityType === link.gitfitActivityType &&
                existing.gitfitActivityId === link.gitfitActivityId
              ),
          ),
        ]);
      },
      addSession: (session) => {
        // endedAt mirrors the row's created_at (server-stamped on insert).
        const saved = { ...session, endedAt: session.endedAt ?? new Date().toISOString() };
        apply('sessions', (sessions) => [saved, ...sessions]);
        persist('session', remote.insertSession(saved));
      },
      addCardioSession: (session) => {
        const saved = { ...session, endedAt: session.endedAt ?? new Date().toISOString() };
        apply('cardioSessions', (cardioSessions) => [saved, ...cardioSessions]);
        persist('cardio session', remote.insertCardioSession(saved));
      },
      updateCardioSession: (session) => {
        apply('cardioSessions', (cardioSessions) =>
          cardioSessions.map((existing) => (existing.id === session.id ? session : existing)),
        );
        persist('cardio session update', remote.updateCardioSession(session));
      },
      setGoals: (goals) => {
        apply('goals', () => goals);
        const keptIds = new Set(goals.map((goal) => goal.id));
        apply('goalEntries', (entries) => entries.filter((entry) => keptIds.has(entry.goalId)));
        persist('goals', remote.setGoals(goals));
      },
      addGoalEntry: (entry) => {
        apply('goalEntries', (entries) => [entry, ...entries.filter((existing) => existing.id !== entry.id)]);
        persist('goal entry', remote.insertGoalEntry(entry));
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
      updateWaterEntry: (entry) => {
        apply('waterEntries', (entries) => entries.map((existing) => (existing.id === entry.id ? entry : existing)));
        persist('water entry', remote.updateWaterEntry(entry));
      },
      deleteWaterEntry: (id) => {
        apply('waterEntries', (entries) => entries.filter((existing) => existing.id !== id));
        persist('water entry delete', remote.deleteWaterEntry(id));
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
      logMealEvent: (event, items) => {
        apply('mealEvents', (events) => [event, ...events]);
        // foodLogs is newest-first; the basket is pick order, so the last pick is newest.
        apply('foodLogs', (entries) => [...[...items].reverse(), ...entries]);
        persist('meal event', remote.insertMealEvent(event, items));
      },
      addFoodLogs: (items) => {
        apply('foodLogs', (entries) => [...[...items].reverse(), ...entries]);
        persist('food logs', remote.insertFoodLogs(items));
      },
      updateMealEvent: (event) => {
        apply('mealEvents', (events) => events.map((e) => (e.id === event.id ? event : e)));
        apply('foodLogs', (entries) =>
          entries.map((e) => (e.eventId === event.id && e.date !== event.date ? { ...e, date: event.date } : e)),
        );
        // A synthesized pre-0013 event has no row to update.
        if (!isLegacyEventId(event.id)) persist('meal event', remote.updateMealEvent(event));
      },
      deleteMealEvent: (id) => {
        const foodIds = (data?.foodLogs ?? []).filter((e) => e.eventId === id).map((e) => e.id);
        apply('mealEvents', (events) => events.filter((e) => e.id !== id));
        apply('foodLogs', (entries) => entries.filter((e) => e.eventId !== id));
        if (isLegacyEventId(id)) {
          for (const foodId of foodIds) persist('food log delete', remote.deleteFoodLog(foodId));
        } else {
          persist('meal event delete', remote.deleteMealEvent(id));
        }
      },
      updateFoodLog: (entry) => {
        apply('foodLogs', (entries) => entries.map((e) => (e.id === entry.id ? entry : e)));
        persist('food log', remote.updateFoodLog(entry));
      },
      deleteFoodLog: (id) => {
        const entry = data?.foodLogs.find((e) => e.id === id);
        const isLast = entry && !data?.foodLogs.some((e) => e.eventId === entry.eventId && e.id !== id);
        if (entry && isLast && !isLegacyEventId(entry.eventId)) {
          apply('mealEvents', (events) => events.filter((e) => e.id !== entry.eventId));
          apply('foodLogs', (entries) => entries.filter((e) => e.id !== id));
          persist('meal event delete', remote.deleteMealEvent(entry.eventId));
          return;
        }
        if (entry && isLast) apply('mealEvents', (events) => events.filter((e) => e.id !== entry.eventId));
        apply('foodLogs', (entries) => entries.filter((e) => e.id !== id));
        persist('food log delete', remote.deleteFoodLog(id));
      },
      addRecipe: (recipe) => {
        const position = data?.recipes.length ?? 0;
        apply('recipes', (recipes) => [...recipes, recipe]);
        persist('recipe', remote.insertRecipe(recipe, position));
      },
      updateRecipe: (recipe) => {
        apply('recipes', (recipes) => recipes.map((r) => (r.id === recipe.id ? recipe : r)));
        persist('recipe', remote.updateRecipe(recipe));
      },
      deleteRecipe: (id) => {
        apply('recipes', (recipes) => recipes.filter((r) => r.id !== id));
        persist('recipe delete', remote.deleteRecipe(id));
      },
      setNutritionGoals: (goals) => {
        apply('nutritionGoals', () => goals);
        if (userId) persist('nutrition goals', remote.upsertNutritionGoals(userId, goals));
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
