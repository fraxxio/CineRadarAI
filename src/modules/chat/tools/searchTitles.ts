import { z } from "zod/v4";
import { getGenres, searchTitlesByYear } from "@/infra/tmdb/server";
import { mediaTypeArg, toTitleItem, yearArg } from "./shared";
import { defineTool } from "./types";

const MAX_RESULTS = 5;

export const searchTitles = defineTool({
  name: "search_titles",
  description:
    "Search TMDB for a movie or TV show by title. Returns the top 5 matches with their TMDB id, title, release year, rating, vote count and genres. Use it to check that a title exists and to get its exact id and year.",
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
  async run({ query, type, year }, { signal }) {
    const [page, genres] = await Promise.all([
      searchTitlesByYear({ type, query, year }, { signal }),
      // genres are extra detail: a found title still counts without them
      getGenres(type, { signal }).catch(() => []),
    ]);
    return {
      results: page.results
        .slice(0, MAX_RESULTS)
        .map((hit) => toTitleItem(type, hit, genres)),
    };
  },
});
