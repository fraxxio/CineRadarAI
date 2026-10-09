// TMDB responses, normalised: movie and TV fields share names, only the fields we use

export type MediaType = "movie" | "tv";

// route params arrive as strings, components pass numbers
export type TitleId = number | string;

export type Paged<T> = {
  page: number;
  results: T[];
  totalPages: number;
  totalResults: number;
};

// one search / discover hit
export type TitleSummary = {
  id: number;
  title: string;
  releaseDate: string;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number;
  voteCount: number;
};

// a search / discover hit with its genre ids, see getGenres for the names
export type TitleHit = TitleSummary & { genreIds: number[] };

export type Genre = { id: number; name: string };

type TitleDetailsBase = {
  id: number;
  title: string;
  status: string;
  overview: string;
  genres: { id: number; name: string }[];
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number;
  voteCount: number;
  // movie: release date, TV: first air date
  releaseDate: string;
};

export type MovieDetails = TitleDetailsBase & {
  mediaType: "movie";
  runtime: number;
  budget: number;
  revenue: number;
};

export type TvDetails = TitleDetailsBase & {
  mediaType: "tv";
  lastAirDate: string;
  numberOfSeasons: number;
  showType: string;
};

export type TitleDetails = MovieDetails | TvDetails;

export type TitleWithCredits = TitleDetails & {
  // top-billed first
  cast: string[];
  // TV only, in minutes; null for movies and when TMDB has none
  episodeRuntime: number | null;
};

export type TitleImage = {
  filePath: string;
  voteAverage: number;
  voteCount: number;
};

export type TitleImages = { backdrops: TitleImage[] };

export type TitleVideo = {
  key: string;
  site: string;
  type: string;
};

export type TitleReview = {
  id: string;
  author: string;
  avatarPath: string | null;
  rating: number | null;
  content: string;
};

export type Language = {
  code: string;
  englishName: string;
};
