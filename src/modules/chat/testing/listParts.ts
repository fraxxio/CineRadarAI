// list saves as the chat client gets them, shared by the client tests
import type {
  ListSavedPart,
  PendingSave,
  PreviousEntry,
  SavedEntry,
} from "../protocol";

export const savedEntry = (extra: Partial<SavedEntry> = {}): SavedEntry => ({
  type: "movie",
  id: 228150,
  title: "Fury",
  posterPath: "/fury.jpg",
  image: "/fury-backdrop.jpg",
  status: "Planning to watch",
  ...extra,
});

export const previousEntry = (
  extra: Partial<PreviousEntry> = {},
): PreviousEntry => ({
  name: "Fury",
  image: "/old.jpg",
  status: "Watching",
  rating: 8,
  ...extra,
});

export const listSavedPart = (
  entry: Partial<SavedEntry> = {},
  previous: PreviousEntry | null = null,
  undone?: boolean,
): ListSavedPart => ({
  type: "list_saved",
  entry: savedEntry(entry),
  previous,
  ...(undone === undefined ? {} : { undone }),
});

export const pendingSave = (extra: Partial<PendingSave> = {}): PendingSave => ({
  type: "movie",
  id: 228150,
  title: "Fury",
  posterPath: "/fury.jpg",
  status: "Planning to watch",
  ...extra,
});
