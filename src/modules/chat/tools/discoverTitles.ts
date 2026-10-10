import { z } from "zod/v4";
import { discoverTitles as discover, getGenres } from "@/infra/tmdb/server";
import { mediaTypeArg, toTitleItem, yearArg } from "./shared";
import { ToolError, defineTool } from "./types";

const MAX_RESULTS = 10;

export const discoverTitles = defineTool({
  name: "discover_titles",
  description:
    "List released movies or TV shows from TMDB by release year and genre, sorted by popularity or rating. Returns the top 10 with their TMDB id, title, release year, rating, vote count and genres. Use it for recent releases and for requests where no titles come to mind.",
  status: "Browsing TMDB database...",
  args: z.object({
    type: mediaTypeArg,
    year: yearArg.optional().describe("Release year (first air year for TV)"),
    genre: z
      .string()
      .min(1)
      .max(50)
      .optional()
      .describe('TMDB genre name in English, e.g. "Action", "Science Fiction"'),
    sort: z
      .enum(["popular", "top_rated"])
      .default("popular")
      .describe("popular: most popular first, top_rated: best rated first"),
  }),
  async run({ type, year, genre, sort }, { signal }) {
    const loading = getGenres(type, { signal });
    // needed to filter by genre; otherwise just extra detail
    const genres = await (genre ? loading : loading.catch(() => []));

    let genreId: number | undefined;
    if (genre) {
      const wanted = genre.trim().toLowerCase();
      genreId = genres.find((g) => g.name.toLowerCase() === wanted)?.id;
      if (genreId === undefined) {
        throw new ToolError(
          `Unknown genre "${genre}". Valid ${type} genres: ${genres.map((g) => g.name).join(", ")}`,
        );
      }
    }

    // upcoming titles rank high by popularity: only list released ones
    const today = new Date().toISOString().slice(0, 10);
    const yearEnd = `${year}-12-31`;
    const page = await discover(
      {
        type,
        sort,
        genreIds: genreId === undefined ? undefined : [genreId],
        releasedFrom: year === undefined ? undefined : `${year}-01-01`,
        releasedTo: year !== undefined && yearEnd < today ? yearEnd : today,
      },
      { signal },
    );
    return {
      results: page.results
        .slice(0, MAX_RESULTS)
        .map((hit) => toTitleItem(type, hit, genres)),
    };
  },
});
