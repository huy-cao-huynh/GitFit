import * as Crypto from 'expo-crypto';

/** Client-generated row ids; real UUIDs so they can be Postgres primary keys. */
export function makeId(): string {
  return Crypto.randomUUID();
}

/**
 * True for a meal event synthesized from pre-0013 food rows (see
 * `synthesizeLegacyEvents` in remote.ts) — it has no meal_events row behind it.
 */
export function isLegacyEventId(id: string): boolean {
  return id.startsWith('legacy:');
}
