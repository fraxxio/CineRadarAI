import { z } from "zod";
import type { MediaType } from "@/infra/tmdb";

// `value` is what the DB stores and the UI shows, `slug` is the /my-list?status= value
export const LIST_STATUSES = [
  { value: "Planning to watch", slug: "planning" },
  { value: "Completed", slug: "completed" },
  { value: "Watching", slug: "watching" },
] as const;

export type ListStatus = (typeof LIST_STATUSES)[number]["value"];
export type ListStatusSlug = (typeof LIST_STATUSES)[number]["slug"];

const MEDIA_TYPES = ["movie", "tv"] as const satisfies readonly MediaType[];

// movie and TV ids can collide, so an entry is identified by both
export type EntryKey = { movieId: number; type: MediaType };

export type ListEntry = EntryKey & {
  name: string;
  image: string; // "" when TMDB has no poster or backdrop
  status: ListStatus;
  rating: number; // 0 = not rated
};

const statusValues = LIST_STATUSES.map((s) => s.value) as [
  ListStatus,
  ...ListStatus[],
];

export const entryKeyInput = z.object({
  movieId: z.coerce.number().int().positive(),
  type: z.enum(MEDIA_TYPES),
});

// the add/edit dialog payload -> a ListEntry
export const entryInput = entryKeyInput
  .extend({
    title: z.string().min(1),
    // MovieCard/Details send null when TMDB has no poster or backdrop
    image: z
      .string()
      .nullable()
      .transform((image) => image ?? ""),
    status: z.enum(statusValues),
    rating: z.union([z.literal(""), z.coerce.number().int().min(1).max(10)]),
  })
  .transform(
    ({ title, rating, ...entry }): ListEntry => ({
      ...entry,
      name: title,
      rating: rating === "" ? 0 : rating,
    }),
  );
