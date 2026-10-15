import { z } from "zod/v4";
import { getGenres, searchTitlesByYear } from "@/infra/tmdb/server";
import {
  TITLE_ITEM_FIELDS,
  mediaTypeArg,
  toTitleItem,
  yearArg,
} from "./shared";
import { listStatuses } from "./userList";
import { defineTool } from "./types";

const MAX_RESULTS = 5;

export const searchTitles = defineTool({
  name: "search_titles",
  description: `Search TMDB for a movie or TV show by title. Returns the top ${MAX_RESULTS} matches with ${TITLE_ITEM_FIELDS}. Use it to check that a title exists and to get its exact id and year.`,
  status: "Searching TMDB database...",
  args: z.object({
    query: z
      .string()
      .min(1)
      .max(100)
      .describe("The title to look for, in its English form"),
    type: mediaTypeArg,
    year: yearArg
      .optional()
      .describe(
        "Release year (first air year for TV). Leave out when unsure: a wrong year finds nothing.",
      ),
  }),
  async run({ query, type, year }, ctx) {
    const { signal } = ctx;
    const [page, genres, listed] = await Promise.all([
      searchTitlesByYear({ type, query, year }, { signal }),
      // genres are extra detail: a found title still counts without them
      getGenres(type, { signal }).catch(() => []),
      listStatuses(ctx),
    ]);
    return {
      results: page.results
        .slice(0, MAX_RESULTS)
        .map((hit) => toTitleItem(type, hit, genres, listed)),
    };
  },
});
