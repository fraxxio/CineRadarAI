import { z } from "zod";
import type { MediaType } from "@/infra/tmdb";
import { MAX_TITLE_LENGTH } from "@/shared/lib/titleKey";
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

// the chat's save after sign-in -> a TitleToSave; null keeps saveTitle's
// default (Planning to watch for a new title, unchanged otherwise)
export const titleToSaveInput = z
  .object({
    type: z.enum(MEDIA_TYPES),
    id: z.number().int().positive(),
    title: z.string().min(1).max(MAX_TITLE_LENGTH),
    status: z.enum(statusValues).nullable(),
  })
  .transform(({ status, ...title }) => ({
    ...title,
    status: status ?? undefined,
  }));

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
