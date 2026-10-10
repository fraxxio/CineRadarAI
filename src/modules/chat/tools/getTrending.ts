import { z } from "zod/v4";
import { getGenres, getTrending as fetchTrending } from "@/infra/tmdb/server";
import { mediaTypeArg, toTitleItems } from "./shared";
import { defineTool } from "./types";

const MAX_RESULTS = 10;

export const getTrending = defineTool({
  name: "get_trending",
  description:
    'List the released movies or TV shows trending on TMDB today or this week, most trending first; returns the top 10 with their TMDB id, title, release year, rating, vote count and genres. Use it for "popular / trending right now"; for a filtered list (genre, years, rating) use discover_titles instead.',
  status: "Checking what's trending...",
  args: z.object({
    type: mediaTypeArg,
    window: z
      .enum(["day", "week"])
      .default("week")
      .describe("day: trending today, week: trending this week"),
  }),
  async run({ type, window }, { signal }) {
    const [page, genres] = await Promise.all([
      fetchTrending(type, window, { signal }),
      // genres are extra detail: a trending title still counts without them
      getGenres(type, { signal }).catch(() => []),
    ]);
    return {
      results: toTitleItems(type, page.results, genres, MAX_RESULTS),
    };
  },
});
