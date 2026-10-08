// TMDB wire data shared by the tool tests
export const MOVIE_GENRES = {
  genres: [
    { id: 18, name: "Drama" },
    { id: 878, name: "Science Fiction" },
    { id: 10752, name: "War" },
  ],
};

export const TV_GENRES = {
  genres: [
    { id: 18, name: "Drama" },
    { id: 10765, name: "Sci-Fi & Fantasy" },
  ],
};

export const page = (results: object[]) => ({
  page: 1,
  results,
  total_pages: 1,
  total_results: results.length,
});

// a search / discover result with every field TMDB sends that we don't use
export const rawMovie = (id: number, extra: object = {}) => ({
  id,
  title: `Movie ${id}`,
  original_title: `Original ${id}`,
  overview: "Not passed to the model.",
  release_date: "2014-10-15",
  poster_path: "/p.jpg",
  backdrop_path: "/b.jpg",
  popularity: 99.9,
  vote_average: 7.456,
  vote_count: 1234,
  genre_ids: [10752, 18],
  ...extra,
});

export const rawShow = (id: number, extra: object = {}) => ({
  id,
  name: `Show ${id}`,
  original_name: `Original ${id}`,
  overview: "Not passed to the model.",
  first_air_date: "2017-12-01",
  poster_path: "/p.jpg",
  vote_average: 8.04,
  vote_count: 50,
  genre_ids: [10765],
  ...extra,
});
