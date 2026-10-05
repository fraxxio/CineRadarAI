import "server-only";
import { cache } from "react";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/infra/db";
import { entryColumns, listEntries } from "./schema";
import type { EntryKey, ListEntry } from "./entry";

// Each write is a single statement, so it's atomic without a transaction and
// concurrent writes to different entries can't overwrite each other (for the
// same entry, the last write wins).
// The functions stay async so a synchronous throw from the query builder
// becomes a rejection (B8).

// in insertion order: a replaced entry keeps its id, so it keeps its place
export const getEntries = cache(async (userId: string) =>
  db
    .select(entryColumns)
    .from(listEntries)
    .where(eq(listEntries.userId, userId))
    .orderBy(asc(listEntries.id)),
);

// adds the entry, or replaces the one with the same key
export async function saveEntry(userId: string, entry: ListEntry) {
  const { movieId, type, ...fields } = entry;
  await db
    .insert(listEntries)
    .values({ userId, movieId, type, ...fields })
    .onConflictDoUpdate({
      target: [listEntries.userId, listEntries.movieId, listEntries.type],
      set: fields,
    });
}

// movie and TV ids can collide, so an entry is matched on both;
// removing an entry that isn't in the list is a no-op
export async function removeEntry(userId: string, { movieId, type }: EntryKey) {
  await db
    .delete(listEntries)
    .where(
      and(
        eq(listEntries.userId, userId),
        eq(listEntries.movieId, movieId),
        eq(listEntries.type, type),
      ),
    );
}
