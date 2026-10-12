// what the model learns of list changes it didn't make (Undo, saves after
// sign-in): the client sends only their keys, the state comes from the DB
import type { EntryKey, StoredEntry } from "@/modules/my-list";
import type { ChatUser } from "../tools/types";

// loaded only when there are changes: the list's server code needs the DB
// client and React's cache, which scripts/check-chat-tools.ts can't load
const listServer = () => import("@/modules/my-list/server");

const MAX_NAME_LENGTH = 300;

// names come from the add-to-list route, so they can be any text: keep them
// on one line and from closing the note
const clean = (value: string) =>
  value
    .replace(/[[\]\s]+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);

const sameKey = (a: EntryKey, b: EntryKey) =>
  a.movieId === b.movieId && a.type === b.type;

// e.g. [List update: Fury (movie 228150) is Completed; movie 1 is not in the
// list]; a removed title has no row, so only its key is known
export function formatListChangeNote(
  keys: EntryKey[],
  entries: StoredEntry[],
): string | undefined {
  const unique = keys.filter(
    (key, i) => keys.findIndex((other) => sameKey(key, other)) === i,
  );
  if (unique.length === 0) {
    return undefined;
  }
  const states = unique.map((key) => {
    const ref = `${key.type} ${key.movieId}`;
    const entry = entries.find((other) => sameKey(key, other));
    return entry
      ? `${clean(entry.name)} (${ref}) is ${clean(entry.status)}`
      : `${ref} is not in the list`;
  });
  return `[List update: ${states.join("; ")}]`;
}

// undefined when there's nothing to tell, or the list can't be read: the
// chat works without the note
export async function listChangeNote(
  user: ChatUser,
  keys: EntryKey[],
): Promise<string | undefined> {
  if (user.status !== "signed_in" || keys.length === 0) {
    return undefined;
  }
  try {
    const { getEntries } = await listServer();
    return formatListChangeNote(keys, await getEntries(user.id));
  } catch (error) {
    console.error("Couldn't read the list for the list-change note:", error);
    return undefined;
  }
}
