import type { MediaType } from "@/infra/tmdb";

// `value` is what the DB stores and the UI shows, `slug` is the /my-list?status= value
export const LIST_STATUSES = [
  { value: "Planning to watch", slug: "planning" },
  { value: "Completed", slug: "completed" },
  { value: "Watching", slug: "watching" },
] as const;

export type ListStatus = (typeof LIST_STATUSES)[number]["value"];
export type ListStatusSlug = (typeof LIST_STATUSES)[number]["slug"];

export const isListStatus = (status: string): status is ListStatus =>
  LIST_STATUSES.some((s) => s.value === status);

// movie and TV ids can collide, so an entry is identified by both
export type EntryKey = { movieId: number; type: MediaType };

// what the store writes
export type ListEntry = EntryKey & {
  name: string;
  image: string; // "" when TMDB has no poster or backdrop
  status: ListStatus;
  rating: number; // 0 = not rated
};

// what a stored row holds: rows saved before the payload was validated can
// have other statuses
export type StoredEntry = Omit<ListEntry, "status"> & { status: string };
