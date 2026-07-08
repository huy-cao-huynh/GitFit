import * as Crypto from 'expo-crypto';

/** Client-generated row ids; real UUIDs so they can be Postgres primary keys. */
export function makeId(): string {
  return Crypto.randomUUID();
}
