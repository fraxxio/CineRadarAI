import { z } from "zod";
import type { MediaType } from "@/infra/tmdb";
import { LIST_STATUSES, type ListEntry, type ListStatus } from "./entry";

// apart from entry.ts, so client components that need LIST_STATUSES don't ship zod

const MEDIA_TYPES = ["movie", "tv"] as const satisfies readonly MediaType[];

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
