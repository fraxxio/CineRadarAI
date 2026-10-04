import type { MediaType } from "@/infra/tmdb";
import { LIST_STATUSES, type ListStatusSlug, type StoredEntry } from "./entry";

// the /my-list search params
export type ListView = {
  type: MediaType | "both";
  status: ListStatusSlug | "all";
  rating: "asc" | "desc";
};

export const viewEntries = (
  entries: StoredEntry[],
  { type, status, rating }: ListView,
) => {
  if (type !== "both") {
    entries = entries.filter((entry) => entry.type === type);
  }
  const statusValue = LIST_STATUSES.find((s) => s.slug === status)?.value;
  if (statusValue) {
    entries = entries.filter((entry) => entry.status === statusValue);
  }

  const compare = (a: StoredEntry, b: StoredEntry) =>
    rating === "asc" ? a.rating - b.rating : b.rating - a.rating;
  // copy so the cached array isn't sorted in place
  return [...entries].sort(compare);
};
