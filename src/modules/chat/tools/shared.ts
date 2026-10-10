// args and result fields shared by the TMDB tools
import { z } from "zod/v4";
import type { Genre, MediaType, TitleHit } from "@/infra/tmdb";

export const mediaTypeArg = z
  .enum(["movie", "tv"])
  .describe("movie for films, tv for TV shows");

// explicit bounds: a bare int() puts the safe-integer range in the schema
export const yearArg = z.number().int().min(1870).max(2100);

export const personIdArg = z
  .number()
  .int()
  .min(1)
  .describe("TMDB person id from search_person results");

// "YYYY-MM-DD" in UTC, the same date the system prompt gives the model
export const today = () => new Date().toISOString().slice(0, 10);

// TMDB lists upcoming and adult titles in trending, recommendations and
// credits; only released, non-adult ones get recommended
export const isReleased = (hit: TitleHit, asOf: string) =>
  hit.releaseDate !== "" && hit.releaseDate <= asOf && !hit.adult;

// "2014-10-15" -> 2014, null when TMDB has no date
export const yearOf = (date: string) =>
  date ? Number(date.slice(0, 4)) : null;

export const roundRating = (voteAverage: number) =>
  Math.round(voteAverage * 10) / 10;

export const genreNames = (ids: number[], genres: Genre[]) =>
  ids.flatMap((id) => genres.find((genre) => genre.id === id)?.name ?? []);

// one search / discover result as the model sees it
export const toTitleItem = (
  type: MediaType,
  hit: TitleHit,
  genres: Genre[],
) => ({
  id: hit.id,
  type,
  title: hit.title,
  year: yearOf(hit.releaseDate),
  rating: roundRating(hit.voteAverage),
  votes: hit.voteCount,
  genres: genreNames(hit.genreIds, genres),
});

// the released ones of a TMDB list, as model items; the limit counts after
// filtering
export const toTitleItems = (
  type: MediaType,
  hits: TitleHit[],
  genres: Genre[],
  limit: number,
) => {
  const asOf = today();
  return hits
    .filter((hit) => isReleased(hit, asOf))
    .slice(0, limit)
    .map((hit) => toTitleItem(type, hit, genres));
};
