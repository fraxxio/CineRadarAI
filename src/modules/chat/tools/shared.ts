// args and result fields shared by the TMDB tools
import { z } from "zod/v4";
import type { Genre, MediaType, TitleHit } from "@/infra/tmdb";
import { MAX_TITLE_LENGTH } from "@/shared/lib/titleKey";
import { today } from "../date";

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

// list names and statuses come from the add-to-list route, so they can be
// any text: keep them on one line and from closing a bracketed note
export const clean = (value: string) =>
  value
    .replace(/[[\]\s]+/g, " ")
    .trim()
    .slice(0, MAX_TITLE_LENGTH);

// "" (no date) counts as not released
export const isReleased = (releaseDate: string, asOf: string) =>
  releaseDate !== "" && releaseDate <= asOf;

// TMDB lists upcoming and adult titles in trending, recommendations and
// credits; the tools list only released, non-adult ones
export const isListable = (hit: TitleHit, asOf: string) =>
  isReleased(hit.releaseDate, asOf) && !hit.adult;

// "2014-10-15" -> 2014, null when TMDB has no date
export const yearOf = (date: string) =>
  date ? Number(date.slice(0, 4)) : null;

export const roundRating = (voteAverage: number) =>
  Math.round(voteAverage * 10) / 10;

export const genreNames = (ids: number[], genres: Genre[]) =>
  ids.flatMap((id) => genres.find((genre) => genre.id === id)?.name ?? []);

// the fields of toTitleItem, for the tool descriptions
export const TITLE_ITEM_FIELDS =
  "their TMDB id, title, release year, rating, vote count and genres";

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

// the listable ones of a TMDB list, as model items; the limit counts after
// filtering
export const toTitleItems = (
  type: MediaType,
  hits: TitleHit[],
  genres: Genre[],
  limit: number,
) => {
  const asOf = today();
  return hits
    .filter((hit) => isListable(hit, asOf))
    .slice(0, limit)
    .map((hit) => toTitleItem(type, hit, genres));
};
