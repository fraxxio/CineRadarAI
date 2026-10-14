// saves a title by its TMDB id, for the chat and the save after sign-in
import "server-only";
import type { MediaType, TitleDetails } from "@/infra/tmdb";
import { TmdbError, getTitle, type FetchOptions } from "@/infra/tmdb/server";
import { matchesTitle } from "@/shared/lib/titleKey";
import {
  isListStatus,
  type ListStatus,
  type PreviousEntry,
  type SavedEntry,
} from "./entry";
import { getEntry, saveEntryStatus } from "./store";

export type TitleToSave = {
  type: MediaType;
  id: number;
  // the name the caller knows it by, checked against TMDB's
  title: string;
  // undefined: "Planning to watch" for a new title, unchanged otherwise
  status?: ListStatus;
};

type Rejection =
  | { reason: "not_found" }
  // adult: not named, like the titles the chat lists
  | { reason: "not_available" }
  // a real id of another title
  | { reason: "title_mismatch"; tmdbTitle: string };

// the title can't be saved; nothing was written
export class SaveTitleError extends Error {
  constructor(readonly rejection: Rejection) {
    super(`Can't save the title: ${rejection.reason}`);
    this.name = "SaveTitleError";
  }
}

// TMDB's data for the title, if it's one that can be saved; a failed TMDB
// request other than a 404 is thrown as is
export async function checkTitle(
  { type, id, title }: TitleToSave,
  options?: FetchOptions,
): Promise<TitleDetails> {
  let details: TitleDetails;
  try {
    details = await getTitle(type, id, options);
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) {
      throw new SaveTitleError({ reason: "not_found" });
    }
    throw error;
  }
  if (details.adult) {
    throw new SaveTitleError({ reason: "not_available" });
  }
  if (!matchesTitle(title, details)) {
    throw new SaveTitleError({
      reason: "title_mismatch",
      tmdbTitle: details.title,
    });
  }
  return details;
}

// never changes the rating; `previous` is what Undo restores, null when the
// title was new
export async function saveTitle(
  userId: string,
  toSave: TitleToSave,
  options: FetchOptions = {},
): Promise<{ entry: SavedEntry; previous: PreviousEntry | null }> {
  const details = await checkTitle(toSave, options);
  const { type, id, status } = toSave;
  const key = { movieId: id, type };

  // read, then write: an edit in between (e.g. in another tab) makes Undo
  // restore what was there before it; rare, and the user can fix it in the list
  const stored = await getEntry(userId, key);
  const previous = stored
    ? {
        name: stored.name,
        image: stored.image,
        status: stored.status,
        rating: stored.rating,
      }
    : null;
  const entry: SavedEntry = {
    type,
    id,
    title: details.title,
    posterPath: details.posterPath,
    // an existing row keeps its image
    image:
      previous?.image ?? (details.backdropPath || details.posterPath || ""),
    status: status ?? "Planning to watch",
  };

  // already in the list and no status asked for: nothing to change; a status
  // the list doesn't know (an old row) is replaced, like an unset one
  if (!status && previous && isListStatus(previous.status)) {
    return { entry: { ...entry, status: previous.status }, previous };
  }
  // the turn was stopped or timed out during the lookups: don't save behind
  // the model's back
  if (options.signal?.aborted) {
    throw options.signal.reason;
  }
  await saveEntryStatus(userId, {
    ...key,
    name: details.title,
    image: entry.image,
    status: entry.status,
  });
  return { entry, previous };
}
