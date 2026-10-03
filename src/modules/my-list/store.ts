import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, writeTransaction, type Tx } from "@/infra/db";
import { lists } from "./schema";
import type { EntryKey, ListEntry } from "./entry";

// movie and TV ids can collide, so an entry is matched on both
const isEntry = (key: EntryKey) => (entry: EntryKey) =>
  entry.movieId === key.movieId && entry.type === key.type;

const selectEntries = (tx: Tx | typeof db, userId: string) =>
  tx
    .select({ movies: lists.movies })
    .from(lists)
    .where(eq(lists.userId, userId))
    .limit(1);

export const getEntries = cache(async (userId: string) => {
  const [row] = await selectEntries(db, userId);
  return row?.movies ?? [];
});

// Writes read-modify-write the JSON blob inside a write transaction, so concurrent
// saves are serialised instead of overwriting each other.
// Keep them short: one select, one write, no network calls.

// adds the entry, or replaces the one with the same key
export function saveEntry(userId: string, entry: ListEntry) {
  return writeTransaction(async (tx) => {
    const [row] = await selectEntries(tx, userId);
    if (!row) {
      await tx.insert(lists).values({ userId, movies: [entry] });
      return;
    }
    const entries = row.movies ?? [];
    const index = entries.findIndex(isEntry(entry));
    const movies =
      index === -1
        ? [...entries, entry]
        : entries.map((e, i) => (i === index ? entry : e));
    await tx.update(lists).set({ movies }).where(eq(lists.userId, userId));
  });
}

// resolves false when the user has no list
export function removeEntry(userId: string, key: EntryKey) {
  return writeTransaction(async (tx) => {
    const [row] = await selectEntries(tx, userId);
    if (!row) return false;
    const movies = (row.movies ?? []).filter((entry) => !isEntry(key)(entry));
    await tx.update(lists).set({ movies }).where(eq(lists.userId, userId));
    return true;
  });
}

// pass `tx` to delete the list as part of a larger transaction (account deletion)
export async function clearList(userId: string, tx: Tx | typeof db = db) {
  await tx.delete(lists).where(eq(lists.userId, userId));
}
