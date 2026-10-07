// TMDB wire shapes (only the fields we read) and their mapping to ./types
import type {
  Genre,
  Language,
  MediaType,
  Paged,
  TitleDetails,
  TitleHit,
  TitleImages,
  TitleReview,
  TitleSummary,
  TitleVideo,
  TitleWithCredits,
} from "./types";

export type RawPaged<T> = {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
};

// movies carry title / release_date, TV shows name / first_air_date
export type RawSummary = {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average: number;
  vote_count: number;
  // search / discover only
  genre_ids?: number[];
};

export type RawDetails = RawSummary & {
  status: string;
  overview: string;
  genres: { id: number; name: string }[];
  runtime?: number;
  budget?: number;
  revenue?: number;
  last_air_date?: string;
  number_of_seasons?: number;
  type?: string;
  // TV only, usually one value, empty for many newer shows
  episode_run_time?: number[];
  // only with append_to_response=credits
  credits?: { cast: { name: string; order: number }[] };
};

export type RawGenres = { genres: Genre[] };

export type RawImages = {
  backdrops: { file_path: string; vote_average: number; vote_count: number }[];
};

export type RawVideos = { results: TitleVideo[] };

export type RawReview = {
  id: string;
  author: string;
  author_details: { avatar_path?: string | null; rating?: number | null };
  content: string;
};

export type RawLanguage = { iso_639_1: string; english_name: string };

export const toPaged = <R, T>(
  raw: RawPaged<R>,
  map: (r: R) => T,
): Paged<T> => ({
  page: raw.page,
  results: raw.results.map(map),
  totalPages: raw.total_pages,
  totalResults: raw.total_results,
});

export const toSummary = (type: MediaType, raw: RawSummary): TitleSummary => ({
  id: raw.id,
  title: (type === "movie" ? raw.title : raw.name) ?? "",
  releaseDate: (type === "movie" ? raw.release_date : raw.first_air_date) ?? "",
  posterPath: raw.poster_path ?? null,
  backdropPath: raw.backdrop_path ?? null,
  voteAverage: raw.vote_average,
  voteCount: raw.vote_count,
});

export const toHit = (type: MediaType, raw: RawSummary): TitleHit => ({
  ...toSummary(type, raw),
  genreIds: raw.genre_ids ?? [],
});

export function toDetails(type: MediaType, raw: RawDetails): TitleDetails {
  const base = {
    ...toSummary(type, raw),
    status: raw.status,
    overview: raw.overview,
    genres: raw.genres,
  };
  return type === "movie"
    ? {
        ...base,
        mediaType: "movie",
        runtime: raw.runtime ?? 0,
        budget: raw.budget ?? 0,
        revenue: raw.revenue ?? 0,
      }
    : {
        ...base,
        mediaType: "tv",
        lastAirDate: raw.last_air_date ?? "",
        numberOfSeasons: raw.number_of_seasons ?? 0,
        showType: raw.type ?? "",
      };
}

export const toTitleWithCredits = (
  type: MediaType,
  raw: RawDetails,
): TitleWithCredits => ({
  ...toDetails(type, raw),
  cast: [...(raw.credits?.cast ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((member) => member.name),
  episodeRuntime: raw.episode_run_time?.[0] ?? null,
});

export const toImages = (raw: RawImages): TitleImages => ({
  backdrops: raw.backdrops.map((image) => ({
    filePath: image.file_path,
    voteAverage: image.vote_average,
    voteCount: image.vote_count,
  })),
});

export const toVideo = ({ key, site, type }: TitleVideo): TitleVideo => ({
  key,
  site,
  type,
});

export const toReview = (raw: RawReview): TitleReview => ({
  id: raw.id,
  author: raw.author,
  avatarPath: raw.author_details.avatar_path ?? null,
  rating: raw.author_details.rating ?? null,
  content: raw.content,
});

export const toLanguage = (raw: RawLanguage): Language => ({
  code: raw.iso_639_1,
  englishName: raw.english_name,
});
