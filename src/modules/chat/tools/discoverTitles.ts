import { z } from "zod/v4";
import { discoverTitles as discover, getGenres } from "@/infra/tmdb/server";
import { TV_GENRE_NOTE, genreArg, resolveGenreIds } from "./genres";
import {
  mediaTypeArg,
  personIdArg,
  toTitleItem,
  today,
  yearArg,
} from "./shared";
import { ToolError, defineTool } from "./types";

const MAX_RESULTS = 10;

// a person filter takes TMDB ids: resolving names here could pick the wrong
// person with the same name
const personIdsArg = z.array(personIdArg).min(1).max(3);

export const discoverTitles = defineTool({
  name: "discover_titles",
  description: `List released movies or TV shows from TMDB by genre, release years, rating, vote count, original language and (movies only) cast or crew, sorted by popularity, rating or release date; returns the top 10 with their TMDB id, title, release year, rating, vote count and genres. Person ids come from search_person, and withCrew matches any crew job, so for "directed by" use get_person_credits with role "crew" instead. ${TV_GENRE_NOTE}`,
  status: "Browsing TMDB database...",
  args: z.object({
    type: mediaTypeArg,
    genres: z
      .array(genreArg)
      .min(1)
      .max(3)
      .optional()
      .describe("Titles must have all of these genres"),
    excludeGenres: z
      .array(genreArg)
      .min(1)
      .max(5)
      .optional()
      .describe("Titles must have none of these genres"),
    yearFrom: yearArg
      .optional()
      .describe("First release year (first air year for TV), included"),
    yearTo: yearArg
      .optional()
      .describe("Last release year, included. For one year, set both to it."),
    minRating: z
      .number()
      .min(0)
      .max(10)
      .optional()
      .describe("Lowest TMDB rating, 0-10"),
    minVotes: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        "Lowest TMDB vote count; replaces the default floor for top_rated, minRating and newest",
      ),
    withCast: personIdsArg
      .optional()
      .describe("Movies only: all of these people are in the cast"),
    withCrew: personIdsArg
      .optional()
      .describe("Movies only: all of these people are in the crew, any job"),
    originalLanguage: z
      .string()
      .length(2)
      .optional()
      .describe('ISO 639-1 code of the original language, e.g. "ko"'),
    sort: z
      .enum(["popular", "top_rated", "newest"])
      .default("popular")
      .describe(
        "popular: most popular first, top_rated: best rated first, newest: latest release first",
      ),
  }),
  async run(args, { signal }) {
    const { type, yearFrom, yearTo, withCast, withCrew } = args;
    // checked before any request: the model can fix these
    if (yearFrom !== undefined && yearTo !== undefined && yearFrom > yearTo) {
      throw new ToolError(
        `yearFrom (${yearFrom}) is after yearTo (${yearTo}).`,
      );
    }
    if (type === "tv" && (withCast || withCrew)) {
      throw new ToolError(
        "Cast and crew filters work for movies only. For TV, use get_person_credits.",
      );
    }

    const filtersGenres = Boolean(args.genres || args.excludeGenres);
    const loading = getGenres(type, { signal });
    // needed to filter by genre; otherwise just extra detail
    const genres = await (filtersGenres ? loading : loading.catch(() => []));

    const page = await discover(
      {
        type,
        sort: args.sort,
        genreIds: resolveGenreIds(type, args.genres ?? [], genres),
        withoutGenreIds: resolveGenreIds(
          type,
          args.excludeGenres ?? [],
          genres,
        ),
        ...releaseRange(yearFrom, yearTo),
        minRating: args.minRating,
        minVotes: args.minVotes,
        castIds: withCast,
        crewIds: withCrew,
        originalLanguage: args.originalLanguage?.toLowerCase(),
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

// years -> TMDB date range; upcoming titles rank high by popularity, so the
// range never goes past today (a future yearFrom lists nothing)
function releaseRange(yearFrom?: number, yearTo?: number) {
  const now = today();
  const yearEnd = yearTo === undefined ? now : `${yearTo}-12-31`;
  return {
    releasedFrom: yearFrom === undefined ? undefined : `${yearFrom}-01-01`,
    releasedTo: yearEnd < now ? yearEnd : now,
  };
}
