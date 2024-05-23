type fetchMoviesProps = {
  searchString?: string | undefined;
  language?: string | undefined;
  year?: string | undefined;
  adult?: boolean | undefined;
  btn?: string | undefined;
  page?: string | undefined;
};

type Results = {
  adult: boolean;
  backdrop_path: string;
  genre_ids: Array<number>;
  id: number;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string;
  release_date: string;
  first_air_date: string;
  title: string;
  name: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
};

type FetchedData = {
  page: number;
  results: Results[];
  total_pages: number;
  total_results: number;
};
