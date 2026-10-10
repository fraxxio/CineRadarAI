// server-only: every TMDB request goes through these queries
import "server-only";
import { tmdbFetch, type FetchOptions } from "./client";
import {
  toCastCredit,
  toCrewCredit,
  toDetails,
  toHit,
  toImages,
  toLanguage,
  toPaged,
  toPersonHit,
  toReview,
  toSummary,
  toTitleWithCredits,
  toVideo,
  type RawCredits,
  type RawDetails,
  type RawGenres,
  type RawImages,
  type RawLanguage,
  type RawPaged,
  type RawPerson,
  type RawReview,
  type RawSummary,
  type RawVideos,
} from "./normalise";
import type {
  Genre,
  Language,
  MediaType,
  Paged,
  PersonCredits,
  PersonHit,
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

export type DiscoverSort = "popular" | "top_rated" | "newest";

export type DiscoverTitlesParams = {
  type: MediaType;
  sort: DiscoverSort;
  // all of them must match; [] means no filter
  genreIds?: number[];
  withoutGenreIds?: number[];
  // "2010-01-01": release (first air) date range, both ends included
  releasedFrom?: string;
  releasedTo?: string;
  minRating?: number;
  // overrides the default vote floor
  minVotes?: number;
  // movies only: /discover/tv ignores them
  castIds?: number[];
  crewIds?: number[];
  // ISO 639-1, e.g. "ko"
  originalLanguage?: string;
};

// movies filter on the primary release date, TV on the first air date
const releaseDateKey = (type: MediaType) =>
  type === "movie" ? "primary_release_date" : "first_air_date";

const SORT_BY: Record<DiscoverSort, (type: MediaType) => string> = {
  popular: () => "popularity.desc",
  top_rated: () => "vote_average.desc",
  newest: (type) => `${releaseDateKey(type)}.desc`,
};

// without a vote floor, titles with a single 10/10 vote top the list
const TOP_RATED_MIN_VOTES: Record<MediaType, number> = { movie: 200, tv: 100 };
// newest first is otherwise led by zero-vote uploads
const NEWEST_MIN_VOTES = 10;

const minVotesFor = ({
  type,
  sort,
  minRating,
  minVotes,
}: DiscoverTitlesParams) => {
  if (minVotes !== undefined) {
    return minVotes;
  }
  if (sort === "top_rated" || minRating !== undefined) {
    return TOP_RATED_MIN_VOTES[type];
  }
  // popular needs none: popular titles have votes
  return sort === "newest" ? NEWEST_MIN_VOTES : undefined;
};

// "," means all of them; an empty list sends nothing, never `with_genres=`
const idList = (ids: number[] | undefined) =>
  ids?.length ? ids.join(",") : undefined;

export async function discoverTitles(
  params: DiscoverTitlesParams,
  options?: FetchOptions,
): Promise<Paged<TitleHit>> {
  const { type, sort, releasedFrom, releasedTo, minRating } = params;
  const castIds = idList(params.castIds);
  const crewIds = idList(params.crewIds);
  // TMDB would ignore them and answer unfiltered titles
  if (type === "tv" && (castIds || crewIds)) {
    throw new Error("Cast and crew filters work for movies only");
  }
  const dateKey = releaseDateKey(type);
  const raw = await tmdbFetch<RawPaged<RawSummary>>(
    `/discover/${type}`,
    {
      language: "en-US",
      include_adult: false,
      with_genres: idList(params.genreIds),
      without_genres: idList(params.withoutGenreIds),
      [`${dateKey}.gte`]: releasedFrom,
      [`${dateKey}.lte`]: releasedTo,
      "vote_average.gte": minRating,
      with_cast: castIds,
      with_crew: crewIds,
      with_original_language: params.originalLanguage,
      sort_by: SORT_BY[sort](type),
      "vote_count.gte": minVotesFor(params),
    },
    "discover results",
    options,
  );
  return toPaged(raw, (result) => toHit(type, result));
}

// genre lists rarely change: kept for the life of the server instance;
// the request itself is cached, so parallel calls share it (and the first
// caller's signal); failures aren't cached, the next call retries
const genreCache = new Map<MediaType, Promise<Genre[]>>();

export function getGenres(
  type: MediaType,
  options?: FetchOptions,
): Promise<Genre[]> {
  const cached = genreCache.get(type);
  if (cached) {
    return cached;
  }
  const genres = tmdbFetch<RawGenres>(
    `/genre/${type}/list`,
    { language: "en-US" },
    `${type} genres`,
    options,
  ).then((raw) => raw.genres);
  genreCache.set(type, genres);
  genres.catch(() => genreCache.delete(type));
  return genres;
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

export async function searchPeople(
  query: string,
  options?: FetchOptions,
): Promise<Paged<PersonHit>> {
  const raw = await tmdbFetch<RawPaged<RawPerson>>(
    "/search/person",
    { query, language: "en-US", include_adult: false },
    "people",
    options,
  );
  return toPaged(raw, toPersonHit);
}

export async function getTrending(
  type: MediaType,
  window: "day" | "week",
  options?: FetchOptions,
): Promise<Paged<TitleHit>> {
  const raw = await tmdbFetch<RawPaged<RawSummary>>(
    `/trending/${type}/${window}`,
    { language: "en-US" },
    `trending ${type}`,
    options,
  );
  return toPaged(raw, (result) => toHit(type, result));
}

export async function getRecommendations(
  type: MediaType,
  id: TitleId,
  options?: FetchOptions,
): Promise<Paged<TitleHit>> {
  const raw = await tmdbFetch<RawPaged<RawSummary>>(
    `/${type}/${id}/recommendations`,
    { language: "en-US" },
    `${type} recommendations`,
    options,
  );
  return toPaged(raw, (result) => toHit(type, result));
}

export async function getSimilarTitles(
  type: MediaType,
  id: TitleId,
  options?: FetchOptions,
): Promise<Paged<TitleHit>> {
  const raw = await tmdbFetch<RawPaged<RawSummary>>(
    `/${type}/${id}/similar`,
    { language: "en-US" },
    `similar ${type} titles`,
    options,
  );
  return toPaged(raw, (result) => toHit(type, result));
}

// a person's movies or TV shows, in front of (cast) or behind (crew) the camera
export async function getPersonCredits(
  type: MediaType,
  personId: number,
  options?: FetchOptions,
): Promise<PersonCredits> {
  const raw = await tmdbFetch<RawCredits>(
    `/person/${personId}/${type}_credits`,
    { language: "en-US" },
    `person ${type} credits`,
    options,
  );
  return {
    cast: raw.cast.map((credit) => toCastCredit(type, credit)),
    crew: raw.crew.map((credit) => toCrewCredit(type, credit)),
  };
}
