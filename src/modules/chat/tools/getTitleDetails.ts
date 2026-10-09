import { z } from "zod/v4";
import { getTitleWithCredits } from "@/infra/tmdb/server";
import { mediaTypeArg, roundRating, yearOf } from "./shared";
import { defineTool } from "./types";

const MAX_OVERVIEW_LENGTH = 300;
const MAX_CAST = 5;

const shorten = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

export const getTitleDetails = defineTool({
  name: "get_title_details",
  description:
    "Get details of one movie or TV show by its TMDB id: genres, runtime (movies) or seasons and episode runtime (TV), rating, overview and top-billed cast. Use it only when a constraint needs these, e.g. an actor, genre or runtime.",
  status: "Checking title details...",
  args: z.object({
    type: mediaTypeArg,
    id: z
      .number()
      .int()
      .min(1)
      .describe("TMDB id from search or discover results"),
  }),
  async run({ type, id }, { signal }) {
    const title = await getTitleWithCredits(type, id, { signal });
    return {
      id: title.id,
      type,
      title: title.title,
      year: yearOf(title.releaseDate),
      genres: title.genres.map((genre) => genre.name),
      ...(title.mediaType === "movie"
        ? { runtime: title.runtime || null }
        : {
            seasons: title.numberOfSeasons,
            episodeRuntime: title.episodeRuntime,
          }),
      rating: roundRating(title.voteAverage),
      votes: title.voteCount,
      overview: shorten(title.overview, MAX_OVERVIEW_LENGTH),
      cast: title.cast.slice(0, MAX_CAST),
    };
  },
});
