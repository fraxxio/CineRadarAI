// what the model learns of list changes it didn't make (Undo, saves after
// sign-in): the client sends only their keys, the state comes from the DB
import type { EntryKey, StoredEntry } from "@/modules/my-list";
import { clean } from "../tools/shared";
import type { ToolContext } from "../tools/types";

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

// undefined when there's nothing to tell, the user isn't signed in, or the
// list can't be read: the chat works without the note. Reads through the
// turn's list, so the tools reuse the read
export async function listChangeNote(
  list: ToolContext["list"],
  keys: EntryKey[],
): Promise<string | undefined> {
  if (keys.length === 0) {
    return undefined;
  }
  try {
    const entries = await list();
    return entries ? formatListChangeNote(keys, entries) : undefined;
  } catch (error) {
    console.error("Couldn't read the list for the list-change note:", error);
    return undefined;
  }
}
