"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/infra/auth/auth";
import { removeEntry, updateEntry } from "./server";
import {
  entryKeyInput,
  entryRatingInput,
  entryStatusInput,
} from "./entryInput";
import type { EntryKey } from "./entry";

export type ListActionResult = { ok: true } | { ok: false };

// the list row's inline edits and remove. The arguments come from the client,
// so they're validated here; a failure is returned, never thrown
async function runForUser(
  key: EntryKey,
  write: (userId: string, key: EntryKey) => Promise<boolean>,
): Promise<ListActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  const parsedKey = entryKeyInput.safeParse(key);
  if (!userId || !parsedKey.success) return { ok: false };

  try {
    const ok = await write(userId, parsedKey.data);
    // also when the title was gone, so the page drops its stale row
    revalidatePath("/my-list");
    return { ok };
  } catch (error) {
    console.error(error);
    return { ok: false };
  }
}

export async function updateEntryStatus(
  key: EntryKey,
  status: string,
): Promise<ListActionResult> {
  const parsed = entryStatusInput.safeParse(status);
  if (!parsed.success) return { ok: false };
  return runForUser(key, (userId, key) =>
    updateEntry(userId, key, { status: parsed.data }),
  );
}

export async function updateEntryRating(
  key: EntryKey,
  rating: number,
): Promise<ListActionResult> {
  const parsed = entryRatingInput.safeParse(rating);
  if (!parsed.success) return { ok: false };
  return runForUser(key, (userId, key) =>
    updateEntry(userId, key, { rating: parsed.data }),
  );
}

// removing a title that's already gone succeeds, like the route
export async function removeListEntry(
  key: EntryKey,
): Promise<ListActionResult> {
  return runForUser(key, async (userId, key) => {
    await removeEntry(userId, key);
    return true;
  });
}
