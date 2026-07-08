import AsyncStorage from '@react-native-async-storage/async-storage';

/** Versioned so a future Supabase-backed store can migrate or ignore old data. */
export const StorageKeys = {
  routines: 'gymapp/v1/routines',
  sessions: 'gymapp/v1/sessions',
  goals: 'gymapp/v1/goals',
  checkoffDefs: 'gymapp/v1/checkoff-defs',
  checkoffLog: 'gymapp/v1/checkoff-log',
  bodyweight: 'gymapp/v1/bodyweight',
  steps: 'gymapp/v1/steps',
  seeded: 'gymapp/v1/seeded',
} as const;

export async function loadJSON<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function saveJSONAsync(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

/** Fire-and-forget persist for mutators; failures only log. */
export function saveJSON(key: string, value: unknown): void {
  saveJSONAsync(key, value).catch((error) => {
    console.warn(`Failed to persist ${key}`, error);
  });
}

export function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
