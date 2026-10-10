import { z } from "zod/v4";
import {
  getGenres,
  getRecommendations as fetchRecommendations,
} from "@/infra/tmdb/server";
import { mediaTypeArg, toTitleItems } from "./shared";
import { defineTool } from "./types";

const MAX_RESULTS = 10;

export const getRecommendations = defineTool({
  name: "get_recommendations",
  description:
    'List released movies or TV shows TMDB recommends to fans of one title; returns the top 10 with their TMDB id, title, release year, rating, vote count and genres. Use it for "something like <title>": take the id and type from the same tool result, because movie and TV ids overlap. It is often empty for lesser-known titles, so call get_similar in parallel.',
  status: "Finding recommendations...",
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
      fetchRecommendations(type, id, { signal }),
      // genres are extra detail: a recommendation still counts without them
      getGenres(type, { signal }).catch(() => []),
    ]);
    return {
      results: toTitleItems(
        type,
        // the title itself isn't a recommendation
        page.results.filter((hit) => hit.id !== id),
        genres,
        MAX_RESULTS,
      ),
    };
  },
});
