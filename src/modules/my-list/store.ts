import "server-only";
import { cache } from "react";
import { and, asc, count, desc, eq, notInArray, sql } from "drizzle-orm";
import { db } from "@/infra/db";
import { entryColumns, listEntries } from "./schema";
import {
  LIST_STATUSES,
  type EntryKey,
  type ListEntry,
  type ListStatus,
  type StoredEntry,
} from "./entry";
import {
  PAGE_SIZE,
  SHELF_SIZE,
  type ListCountRow,
  type ListView,
  type ShelfStatus,
} from "./view";

// Each write is a single statement, so it's atomic without a transaction and
// concurrent writes to different entries can't overwrite each other (for the
// same entry, the last write wins).
// The functions stay async so a synchronous throw from the query builder
// becomes a rejection (B8).

// in insertion order: a replaced entry keeps its id, so it keeps its place.
// Uncached: the chat rereads the list after a save in the same request
export const readEntries = async (userId: string) =>
  db
    .select(entryColumns)
    .from(listEntries)
    .where(eq(listEntries.userId, userId))
    .orderBy(asc(listEntries.id));

const viewFilter = (
  userId: string,
  { status, type }: Pick<ListView, "status" | "type">,
) =>
  and(
    eq(listEntries.userId, userId),
    type === "both" ? undefined : eq(listEntries.type, type),
    status === "all"
      ? undefined
      : status === "other"
        ? notInArray(
            listEntries.status,
            LIST_STATUSES.map((s) => s.value),
          )
        : eq(
            listEntries.status,
            LIST_STATUSES.find((s) => s.slug === status)!.value,
          ),
  );

// rated first, then unrated (0); ties keep insertion order. `recent` uses the
// id as the date added
const viewOrder = ({ sort }: Pick<ListView, "sort">) =>
  sort === "recent"
    ? [desc(listEntries.id)]
    : [
        sql`${listEntries.rating} = 0`,
        sort === "rating-asc"
          ? asc(listEntries.rating)
          : desc(listEntries.rating),
        asc(listEntries.id),
      ];

// one page of the view: [] past the last page
export const getListPage = cache(
  async (userId: string, view: ListView): Promise<StoredEntry[]> =>
    db
      .select(entryColumns)
      .from(listEntries)
      .where(viewFilter(userId, view))
      .orderBy(...viewOrder(view))
      .limit(PAGE_SIZE)
      .offset((view.page - 1) * PAGE_SIZE),
);

// the first rows of one status on the "All" tab, in the view's sort. Not
// cached: the page reads each shelf once, and `cache` would key the fresh
// view object by identity anyway
export const getShelf = async (
  userId: string,
  view: { status: ShelfStatus } & Pick<ListView, "type" | "sort">,
): Promise<StoredEntry[]> =>
  db
    .select(entryColumns)
    .from(listEntries)
    .where(viewFilter(userId, view))
    .orderBy(...viewOrder(view))
    .limit(SHELF_SIZE);

// the count per stored status and type; the page derives every total from it
export const getListCounts = cache(
  async (userId: string): Promise<ListCountRow[]> =>
    db
      .select({
        status: listEntries.status,
        type: listEntries.type,
        count: count(),
      })
      .from(listEntries)
      .where(eq(listEntries.userId, userId))
      .groupBy(listEntries.status, listEntries.type),
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

// movie and TV ids can collide, so an entry is matched on both
const byKey = (userId: string, { movieId, type }: EntryKey) =>
  and(
    eq(listEntries.userId, userId),
    eq(listEntries.movieId, movieId),
    eq(listEntries.type, type),
  );

// undefined when the title isn't in the list
export async function getEntry(
  userId: string,
  key: EntryKey,
): Promise<StoredEntry | undefined> {
  const [entry] = await db
    .select(entryColumns)
    .from(listEntries)
    .where(byKey(userId, key))
    .limit(1);
  return entry;
}

// adds the entry unrated, or changes only the status of the one with the same
// key: its rating, name and image stay as the user saw them
export async function saveEntryStatus(
  userId: string,
  entry: Omit<ListEntry, "rating">,
) {
  const { movieId, type, ...fields } = entry;
  await db
    .insert(listEntries)
    .values({ userId, movieId, type, ...fields, rating: 0 })
    .onConflictDoUpdate({
      target: [listEntries.userId, listEntries.movieId, listEntries.type],
      set: { status: fields.status },
    });
}

// changes only the given fields of an existing entry, never inserts; false
// when the title isn't in the list
export async function updateEntry(
  userId: string,
  key: EntryKey,
  changes: { status?: ListStatus; rating?: number },
): Promise<boolean> {
  const { rowsAffected } = await db
    .update(listEntries)
    .set(changes)
    .where(byKey(userId, key));
  return rowsAffected > 0;
}

// removing an entry that isn't in the list is a no-op
export async function removeEntry(userId: string, key: EntryKey) {
  await db.delete(listEntries).where(byKey(userId, key));
}
