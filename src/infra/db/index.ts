import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN!,
});

export const db = drizzle(client);

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// libsql's default transaction mode is "write" (BEGIN IMMEDIATE), and a remote
// libsql server makes a second writer wait for the lock. The local file client
// doesn't wait: the second writer fails with SQLITE_BUSY and its connection stays
// unusable. Queue write transactions in-process so they never overlap.
// Don't nest them: a writeTransaction inside `fn` waits for itself.
let writeQueue: Promise<unknown> = Promise.resolve();

export function writeTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const result = writeQueue.then(() => db.transaction(fn));
  writeQueue = result.catch(() => {});
  return result;
}
