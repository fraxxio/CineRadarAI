// server-only: every TMDB request goes through these queries
import "server-only";
import { tmdbFetch, type FetchOptions } from "./client";
import {
  toDetails,
  toHit,
  toImages,
  toLanguage,
  toPaged,
  toReview,
  toSummary,
  toTitleWithCredits,
  toVideo,
  type RawDetails,
  type RawGenres,
  type RawImages,
  type RawLanguage,
  type RawPaged,
  type RawReview,
  type RawSummary,
  type RawVideos,
} from "./normalise";
import type {
  Genre,
  Language,
  MediaType,
  Paged,
  TitleDetails,
  TitleHit,
  TitleId,
  TitleImages,
  TitleReview,
  TitleSummary,
  TitleVideo,
  TitleWithCredits,
} from "./types";

export { TmdbError, type FetchOptions } from "./client";

export type FindTitlesParams = {
  mediaType: MediaType;
  query?: string;
  language?: string;
  year?: string;
  includeAdult?: boolean;
  page?: string | number;
};

export async function findTitles({
  mediaType,
  query,
  language,
  year,
  includeAdult,
  page,
}: FindTitlesParams): Promise<Paged<TitleSummary>> {
  // TMDB's search needs a query; without one, discover lists popular titles
  const endpoint = query === undefined ? "discover" : "search";
  const raw = await tmdbFetch<RawPaged<RawSummary>>(
    `/${endpoint}/${mediaType}`,
    { query, include_adult: includeAdult, language, page, year },
    "search results",
  );
  return toPaged(raw, (result) => toSummary(mediaType, result));
}

export async function getTitle(
  type: MediaType,
  id: TitleId,
): Promise<TitleDetails> {
  const raw = await tmdbFetch<RawDetails>(
    `/${type}/${id}`,
    { language: "en-US" },
    `${type} details`,
  );
  return toDetails(type, raw);
}

export async function getTitleImages(
  type: MediaType,
  id: TitleId,
): Promise<TitleImages> {
  const raw = await tmdbFetch<RawImages>(
    `/${type}/${id}/images`,
    {},
    `${type} images`,
  );
  return toImages(raw);
}

export async function getTitleVideos(
  type: MediaType,
  id: TitleId,
): Promise<TitleVideo[]> {
  const raw = await tmdbFetch<RawVideos>(
    `/${type}/${id}/videos`,
    { language: "en-US" },
    `${type} trailer`,
  );
  return raw.results.map(toVideo);
}

export async function getTitleReviews(
  type: MediaType,
  id: TitleId,
  page = 1,
): Promise<Paged<TitleReview>> {
  const raw = await tmdbFetch<RawPaged<RawReview>>(
    `/${type}/${id}/reviews`,
    { language: "en-US", page },
    `${type} reviews`,
  );
  return toPaged(raw, toReview);
}

export async function getLanguages(): Promise<Language[]> {
  const raw = await tmdbFetch<RawLanguage[]>(
    "/configuration/languages",
    {},
    "languages",
  );
  return raw.map(toLanguage);
}

// movies filter on primary_release_year, TV on first_air_date_year; `year`
// would match any release date of a movie and is ignored for TV discover
const yearParam = (type: MediaType, year: number | undefined) =>
  type === "movie"
    ? { primary_release_year: year }
    : { first_air_date_year: year };

export type SearchTitlesParams = {
  type: MediaType;
  query: string;
  year?: number;
};

export async function searchTitlesByYear(
  { type, query, year }: SearchTitlesParams,
  options?: FetchOptions,
): Promise<Paged<TitleHit>> {
  const raw = await tmdbFetch<RawPaged<RawSummary>>(
    `/search/${type}`,
    {
      query,
      language: "en-US",
      include_adult: false,
      ...yearParam(type, year),
    },
    "search results",
    options,
  );
  return toPaged(raw, (result) => toHit(type, result));
}

export type DiscoverSort = "popular" | "top_rated";

export type DiscoverTitlesParams = {
  type: MediaType;
  year?: number;
  genreId?: number;
  sort: DiscoverSort;
};

// without a vote floor, titles with a single 10/10 vote top the list
const TOP_RATED_MIN_VOTES: Record<MediaType, number> = { movie: 200, tv: 100 };

export async function discoverTitles(
  { type, year, genreId, sort }: DiscoverTitlesParams,
  options?: FetchOptions,
): Promise<Paged<TitleHit>> {
  const sortParams =
    sort === "top_rated"
      ? {
          sort_by: "vote_average.desc",
          "vote_count.gte": TOP_RATED_MIN_VOTES[type],
        }
      : { sort_by: "popularity.desc" };
  const raw = await tmdbFetch<RawPaged<RawSummary>>(
    `/discover/${type}`,
    {
      language: "en-US",
      include_adult: false,
      with_genres: genreId,
      ...yearParam(type, year),
      ...sortParams,
    },
    "discover results",
    options,
  );
  return toPaged(raw, (result) => toHit(type, result));
}

// genre lists rarely change: kept for the life of the server instance;
// failures aren't cached, the next call retries
const genreCache = new Map<MediaType, Genre[]>();

export async function getGenres(
  type: MediaType,
  options?: FetchOptions,
): Promise<Genre[]> {
  const cached = genreCache.get(type);
  if (cached) {
    return cached;
  }
  const raw = await tmdbFetch<RawGenres>(
    `/genre/${type}/list`,
    { language: "en-US" },
    `${type} genres`,
    options,
  );
  genreCache.set(type, raw.genres);
  return raw.genres;
}

// details and cast in one request
export async function getTitleWithCredits(
  type: MediaType,
  id: TitleId,
  options?: FetchOptions,
): Promise<TitleWithCredits> {
  const raw = await tmdbFetch<RawDetails>(
    `/${type}/${id}`,
    { language: "en-US", append_to_response: "credits" },
    `${type} details`,
    options,
  );
  return toTitleWithCredits(type, raw);
}
