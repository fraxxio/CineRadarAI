import { z } from "zod/v4";
import { getGenres, getTrending as fetchTrending } from "@/infra/tmdb/server";
import { isTalkOrNews } from "./genres";
import {
  TITLE_ITEM_FIELDS,
  listStatuses,
  mediaTypeArg,
  toTitleItems,
} from "./shared";
import { defineTool } from "./types";

const MAX_RESULTS = 10;

export const getTrending = defineTool({
  name: "get_trending",
  description: `List the released movies or TV shows trending on TMDB today or this week, most trending first; returns the top ${MAX_RESULTS} with ${TITLE_ITEM_FIELDS}. Use it for "popular / trending right now"; for a filtered list (genre, years, rating) use discover_titles instead. Talk and news shows are left out.`,
  status: "Checking what's trending...",
  args: z.object({
    type: mediaTypeArg,
    window: z
      .enum(["day", "week"])
      .default("week")
      .describe("day: trending today, week: trending this week"),
  }),
  async run({ type, window }, ctx) {
    const { signal } = ctx;
    const [page, genres, listed] = await Promise.all([
      fetchTrending(type, window, { signal }),
      // genres are extra detail: a trending title still counts without them
      getGenres(type, { signal }).catch(() => []),
      listStatuses(ctx),
    ]);
    return {
      results: toTitleItems(
        type,
        // the limit counts after this filter too
        page.results.filter((hit) => !isTalkOrNews(hit)),
        genres,
        listed,
        MAX_RESULTS,
      ),
    };
  },
});
