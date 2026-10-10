import { z } from "zod/v4";
import { getGenres, getSimilarTitles } from "@/infra/tmdb/server";
import { mediaTypeArg, toTitleItems } from "./shared";
import { defineTool } from "./types";

const MAX_RESULTS = 10;

export const getSimilar = defineTool({
  name: "get_similar",
  description:
    'List released movies or TV shows TMDB finds similar to one title by genres and keywords; returns the top 10 with their TMDB id, title, release year, rating, vote count and genres. Use it for "something like <title>", in parallel with get_recommendations: take the id and type from the same tool result, because movie and TV ids overlap.',
  status: "Finding similar titles...",
  args: z.object({
    type: mediaTypeArg,
    id: z
      .number()
      .int()
      .min(1)
      .describe("TMDB id of the title, from the same result as its type"),
  }),
  async run({ type, id }, { signal }) {
    const [page, genres] = await Promise.all([
      getSimilarTitles(type, id, { signal }),
      // genres are extra detail: a similar title still counts without them
      getGenres(type, { signal }).catch(() => []),
    ]);
    return {
      results: toTitleItems(
        type,
        // the title itself isn't a suggestion
        page.results.filter((hit) => hit.id !== id),
        genres,
        MAX_RESULTS,
      ),
    };
  },
});
