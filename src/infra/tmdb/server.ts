// server-only: every TMDB request goes through these queries
import { tmdbFetch } from "./client";
import {
  toDetails,
  toImages,
  toLanguage,
  toPaged,
  toReview,
  toSummary,
  toVideo,
  type RawDetails,
  type RawImages,
  type RawLanguage,
  type RawPaged,
  type RawReview,
  type RawSummary,
  type RawVideos,
} from "./normalise";
import type {
  Language,
  MediaType,
  Paged,
  TitleDetails,
  TitleId,
  TitleImages,
  TitleReview,
  TitleSummary,
  TitleVideo,
} from "./types";

export { TmdbError } from "./client";

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
