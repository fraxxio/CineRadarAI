import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL!;

const client = createClient({
  url,
  authToken: process.env.DATABASE_AUTH_TOKEN!,
});

export const db = drizzle(client);

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// libsql's default transaction mode is "write" (BEGIN IMMEDIATE). That lock is
// what serialises concurrent writers and prevents lost updates.
// - A libsql server (Turso in production, sqld in e2e) makes a second writer wait
//   for the lock, from the same instance or another one.
// - The local file client doesn't wait: the second writer fails with SQLITE_BUSY
//   and its connection stays unusable. Its statements run synchronously, so a
//   transaction never yields to I/O. Queueing write transactions in-process is
//   enough to keep them from overlapping, and it costs nothing.
const queueWrites = url.startsWith("file:");
let writeQueue: Promise<unknown> = Promise.resolve();

// a nested write transaction waits for the lock its caller holds, forever
const inWriteTransaction = new AsyncLocalStorage<true>();

export function writeTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (inWriteTransaction.getStore()) {
    return Promise.reject(
      new Error("writeTransaction can't be nested, pass the outer `tx` down"),
    );
  }
  const run = () => inWriteTransaction.run(true, () => db.transaction(fn));
  if (!queueWrites) return run();

  const result = writeQueue.then(run);
  writeQueue = result.catch(() => {});
  return result;
}
