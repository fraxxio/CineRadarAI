import { describe, expect, it, test, vi } from "vitest";
import {
  TmdbError,
  discoverTitles,
  findTitles,
  getLanguages,
  getPersonCredits,
  getRecommendations,
  getSimilarTitles,
  getTitle,
  getTitleImages,
  getTitleReviews,
  getTitleVideos,
  getTitleWithCredits,
  getTrending,
  searchPeople,
  searchTitlesByYear,
} from "./server";
import {
  hangUntilAborted,
  lastTmdbUrl,
  mockTmdb,
  tmdbFixture,
} from "@test/helpers/tmdb";

const EMPTY = { page: 1, results: [], total_pages: 0, total_results: 0 };

// all four search endpoints answer the same page
const mockSearch = (body: unknown = EMPTY) =>
  mockTmdb({
    "/3/discover/movie": body,
    "/3/discover/tv": body,
    "/3/search/movie": body,
    "/3/search/tv": body,
  });

const init = (spy: ReturnType<typeof mockTmdb>) =>
  spy.mock.lastCall![1] as RequestInit & { headers: Record<string, string> };

describe("findTitles", () => {
  test("no query -> discover endpoint", async () => {
    const spy = mockSearch();
    await findTitles({ mediaType: "tv" });
    expect(lastTmdbUrl(spy).pathname).toBe("/3/discover/tv");
    expect(lastTmdbUrl(spy).searchParams.has("query")).toBe(false);
  });

  test("a query -> search endpoint", async () => {
    const spy = mockSearch();
    await findTitles({ mediaType: "movie", query: "Fury" });
    expect(lastTmdbUrl(spy).pathname).toBe("/3/search/movie");
    expect(lastTmdbUrl(spy).searchParams.get("query")).toBe("Fury");
  });

  it.each(["Tom & Jerry", "C#", "a?b=c", "a+b"])(
    "%j is encoded",
    async (query) => {
      const spy = mockSearch();
      await findTitles({ mediaType: "movie", query, year: "2014" });
      const params = lastTmdbUrl(spy).searchParams;
      expect(params.get("query")).toBe(query);
      expect(params.get("year")).toBe("2014");
    },
  );

  test("include_adult, language, page and year are passed through", async () => {
    const spy = mockSearch();
    await findTitles({
      mediaType: "movie",
      query: "Fury",
      includeAdult: true,
      language: "fr",
      page: "2",
      year: "2014",
    });
    expect([...lastTmdbUrl(spy).searchParams]).toEqual([
      ["query", "Fury"],
      ["include_adult", "true"],
      ["language", "fr"],
      ["page", "2"],
      ["year", "2014"],
    ]);
  });

  test("unset params are left out", async () => {
    const spy = mockSearch();
    await findTitles({ mediaType: "movie", includeAdult: false });
    expect([...lastTmdbUrl(spy).searchParams]).toEqual([
      ["include_adult", "false"],
    ]);
  });

  test("sends the bearer token and reads env per call", async () => {
    const spy = mockSearch();
    await findTitles({ mediaType: "movie" });
    expect(init(spy).headers).toEqual({
      accept: "application/json",
      Authorization: "Bearer test-tmdb-token",
    });

    vi.stubEnv("TMDB_ACCESS_TOKEN", "other-token");
    await findTitles({ mediaType: "movie" });
    expect(init(spy).headers.Authorization).toBe("Bearer other-token");
  });

  test("movie and TV results share one shape", async () => {
    mockTmdb({
      "/3/search/movie": {
        page: 2,
        total_pages: 5,
        total_results: 90,
        results: [
          {
            id: 550,
            title: "Fight Club",
            release_date: "1999-10-15",
            poster_path: "/p.jpg",
            backdrop_path: null,
            vote_average: 8.4,
            vote_count: 30000,
          },
        ],
      },
      "/3/search/tv": {
        ...EMPTY,
        results: [
          { id: 1399, name: "Game of Thrones", first_air_date: "2011-04-17" },
        ],
      },
    });

    expect(await findTitles({ mediaType: "movie", query: "x" })).toEqual({
      page: 2,
      totalPages: 5,
      totalResults: 90,
      results: [
        {
          id: 550,
          title: "Fight Club",
          releaseDate: "1999-10-15",
          posterPath: "/p.jpg",
          backdropPath: null,
          voteAverage: 8.4,
          voteCount: 30000,
        },
      ],
    });
    const [tv] = (await findTitles({ mediaType: "tv", query: "x" })).results;
    expect(tv).toMatchObject({
      title: "Game of Thrones",
      releaseDate: "2011-04-17",
      posterPath: null,
      backdropPath: null,
    });
  });

  test("an error status throws TmdbError and logs once", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSearch(new Response("boom", { status: 500 }));

    const error = await findTitles({ mediaType: "movie", query: "x" }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(TmdbError);
    expect(error).toMatchObject({
      status: 500,
      path: "/search/movie",
      message: "Failed to fetch search results (Status: 500)",
    });
    expect(log).toHaveBeenCalledOnce();
  });

  test("a network error is logged and rethrown", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const boom = new TypeError("fetch failed");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(boom);

    await expect(findTitles({ mediaType: "movie" })).rejects.toBe(boom);
    expect(log).toHaveBeenCalledOnce();
  });
});

describe("getTitle", () => {
  test("movie details in English", async () => {
    const spy = mockTmdb({ "/3/movie/550": tmdbFixture("movie-550") });
    const details = await getTitle("movie", 550);

    expect(lastTmdbUrl(spy).pathname).toBe("/3/movie/550");
    expect(lastTmdbUrl(spy).searchParams.get("language")).toBe("en-US");
    expect(details).toMatchObject({
      mediaType: "movie",
      id: 550,
      title: "Fight Club",
      releaseDate: "1999-10-15",
      status: "Released",
      runtime: 139,
    });
  });

  test("TV details, id as a string", async () => {
    const spy = mockTmdb({ "/3/tv/1399": tmdbFixture("tv-1399") });
    const details = await getTitle("tv", "1399");

    expect(lastTmdbUrl(spy).pathname).toBe("/3/tv/1399");
    expect(details).toMatchObject({
      mediaType: "tv",
      title: "Game of Thrones",
      releaseDate: "2011-04-17",
      lastAirDate: "2019-05-19",
      numberOfSeasons: 8,
      showType: "Scripted",
    });
  });

  test("an error names the media type", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockTmdb({ "/3/tv/1": new Response("x", { status: 404 }) });
    await expect(getTitle("tv", 1)).rejects.toMatchObject({
      status: 404,
      message: "Failed to fetch tv details (Status: 404)",
    });
  });
});

describe("title extras", () => {
  test("images: backdrops, no query string", async () => {
    const spy = mockTmdb({ "/3/movie/550/images": tmdbFixture("images") });
    const { backdrops } = await getTitleImages("movie", 550);

    expect(lastTmdbUrl(spy).search).toBe("");
    expect(backdrops[0]).toEqual({
      filePath: "/backdrop-1.jpg",
      voteAverage: 5,
      voteCount: 1,
    });
  });

  test("videos in English", async () => {
    const spy = mockTmdb({ "/3/tv/1399/videos": tmdbFixture("videos") });
    const videos = await getTitleVideos("tv", 1399);

    expect(lastTmdbUrl(spy).searchParams.get("language")).toBe("en-US");
    expect(videos[0]).toEqual({
      key: "bts-key",
      site: "YouTube",
      type: "Featurette",
    });
  });

  test("reviews: page 1 in English by default", async () => {
    const spy = mockTmdb({ "/3/movie/550/reviews": tmdbFixture("reviews") });
    const { results } = await getTitleReviews("movie", 550);

    expect([...lastTmdbUrl(spy).searchParams]).toEqual([
      ["language", "en-US"],
      ["page", "1"],
    ]);
    expect(results[1]).toEqual({
      id: "review-2",
      author: "No Avatar",
      avatarPath: null,
      rating: 7,
      content: "A short review without an avatar.",
    });
  });

  test("reviews: another page", async () => {
    const spy = mockTmdb({ "/3/movie/550/reviews": EMPTY });
    await getTitleReviews("movie", 550, 3);
    expect(lastTmdbUrl(spy).searchParams.get("page")).toBe("3");
  });
});

test("getLanguages", async () => {
  const spy = mockTmdb({
    "/3/configuration/languages": tmdbFixture("languages"),
  });
  const languages = await getLanguages();

  expect(lastTmdbUrl(spy).search).toBe("");
  expect(languages[0]).toEqual({ code: "en", englishName: "English" });
});

const params = (spy: ReturnType<typeof mockTmdb>) => [
  ...lastTmdbUrl(spy).searchParams,
];

describe("searchTitlesByYear", () => {
  test("a movie year goes to primary_release_year", async () => {
    const spy = mockSearch();
    await searchTitlesByYear({ type: "movie", query: "Fury", year: 2014 });

    expect(lastTmdbUrl(spy).pathname).toBe("/3/search/movie");
    expect(params(spy)).toEqual([
      ["query", "Fury"],
      ["language", "en-US"],
      ["include_adult", "false"],
      ["primary_release_year", "2014"],
    ]);
  });

  test("a TV year goes to first_air_date_year", async () => {
    const spy = mockSearch();
    await searchTitlesByYear({ type: "tv", query: "Dark", year: 2017 });

    expect(lastTmdbUrl(spy).pathname).toBe("/3/search/tv");
    expect(params(spy)).toEqual([
      ["query", "Dark"],
      ["language", "en-US"],
      ["include_adult", "false"],
      ["first_air_date_year", "2017"],
    ]);
  });

  test("no year: no year param", async () => {
    const spy = mockSearch();
    await searchTitlesByYear({ type: "movie", query: "Fury" });
    expect(params(spy).map(([key]) => key)).toEqual([
      "query",
      "language",
      "include_adult",
    ]);
  });

  test("hits keep their genre ids, [] when TMDB has none", async () => {
    mockSearch({
      ...EMPTY,
      results: [
        { id: 1, title: "A", vote_average: 7, vote_count: 9, genre_ids: [18] },
        { id: 2, title: "B", vote_average: 7, vote_count: 9 },
      ],
    });
    const { results } = await searchTitlesByYear({ type: "movie", query: "x" });
    expect(results.map((hit) => hit.genreIds)).toEqual([[18], []]);
  });
});

describe("discoverTitles", () => {
  test("popular: by popularity, no vote floor", async () => {
    const spy = mockSearch();
    await discoverTitles({ type: "movie", sort: "popular" });

    expect(lastTmdbUrl(spy).pathname).toBe("/3/discover/movie");
    expect(params(spy)).toEqual([
      ["language", "en-US"],
      ["include_adult", "false"],
      ["sort_by", "popularity.desc"],
    ]);
  });

  it.each([
    ["movie", "primary_release_date"],
    ["tv", "first_air_date"],
  ] as const)("%s: the date range goes to %s", async (type, key) => {
    const spy = mockSearch();
    // releasedTo = today keeps upcoming titles out
    await discoverTitles({
      type,
      sort: "popular",
      releasedFrom: "2026-01-01",
      releasedTo: "2026-10-08",
    });

    expect(lastTmdbUrl(spy).pathname).toBe(`/3/discover/${type}`);
    expect(params(spy)).toEqual([
      ["language", "en-US"],
      ["include_adult", "false"],
      [`${key}.gte`, "2026-01-01"],
      [`${key}.lte`, "2026-10-08"],
      ["sort_by", "popularity.desc"],
    ]);
  });

  it.each([
    ["movie", "popular", "popularity.desc"],
    ["tv", "popular", "popularity.desc"],
    ["movie", "top_rated", "vote_average.desc"],
    ["tv", "top_rated", "vote_average.desc"],
    ["movie", "newest", "primary_release_date.desc"],
    ["tv", "newest", "first_air_date.desc"],
  ] as const)("%s %s: sort_by=%s", async (type, sort, sortBy) => {
    const spy = mockSearch();
    await discoverTitles({ type, sort });
    expect(lastTmdbUrl(spy).searchParams.get("sort_by")).toBe(sortBy);
  });

  it.each([
    ["movie", "200"],
    ["tv", "100"],
  ] as const)(
    "top_rated %s: by rating with a vote floor of %s",
    async (type, floor) => {
      const spy = mockSearch();
      await discoverTitles({
        type,
        sort: "top_rated",
        genreIds: [18],
        releasedFrom: "2020-01-01",
        releasedTo: "2020-12-31",
      });

      const key = type === "movie" ? "primary_release_date" : "first_air_date";
      expect(params(spy)).toEqual([
        ["language", "en-US"],
        ["include_adult", "false"],
        ["with_genres", "18"],
        [`${key}.gte`, "2020-01-01"],
        [`${key}.lte`, "2020-12-31"],
        ["sort_by", "vote_average.desc"],
        ["vote_count.gte", floor],
      ]);
    },
  );

  describe("vote floor", () => {
    const floor = async (params: Parameters<typeof discoverTitles>[0]) => {
      const spy = mockSearch();
      await discoverTitles(params);
      return lastTmdbUrl(spy).searchParams.get("vote_count.gte");
    };

    it.each([
      ["movie", "200"],
      ["tv", "100"],
    ] as const)(
      "minRating alone: the top_rated floor for %s",
      async (type, expected) => {
        expect(await floor({ type, sort: "popular", minRating: 7.5 })).toBe(
          expected,
        );
      },
    );

    test("newest: a small floor", async () => {
      expect(await floor({ type: "tv", sort: "newest" })).toBe("10");
    });

    it.each(["popular", "top_rated", "newest"] as const)(
      "%s: an explicit minVotes wins",
      async (sort) => {
        expect(
          await floor({ type: "movie", sort, minRating: 8, minVotes: 20 }),
        ).toBe("20");
      },
    );

    test("minVotes 0 is sent, not dropped", async () => {
      expect(
        await floor({ type: "movie", sort: "top_rated", minVotes: 0 }),
      ).toBe("0");
    });

    test("plain popular: none", async () => {
      expect(await floor({ type: "movie", sort: "popular" })).toBeNull();
    });
  });

  test("every movie filter, ids joined with ,", async () => {
    const spy = mockSearch();
    await discoverTitles({
      type: "movie",
      sort: "popular",
      genreIds: [878, 18],
      withoutGenreIds: [16, 10751],
      releasedFrom: "2010-01-01",
      releasedTo: "2019-12-31",
      minRating: 7,
      minVotes: 50,
      castIds: [287, 1892],
      crewIds: [138],
      originalLanguage: "ko",
    });

    expect(params(spy)).toEqual([
      ["language", "en-US"],
      ["include_adult", "false"],
      ["with_genres", "878,18"],
      ["without_genres", "16,10751"],
      ["primary_release_date.gte", "2010-01-01"],
      ["primary_release_date.lte", "2019-12-31"],
      ["vote_average.gte", "7"],
      ["with_cast", "287,1892"],
      ["with_crew", "138"],
      ["with_original_language", "ko"],
      ["sort_by", "popularity.desc"],
      ["vote_count.gte", "50"],
    ]);
  });

  test("TV: genre, rating and language filters", async () => {
    const spy = mockSearch();
    await discoverTitles({
      type: "tv",
      sort: "top_rated",
      genreIds: [10765],
      withoutGenreIds: [10767],
      minRating: 8,
      originalLanguage: "ja",
    });

    expect(lastTmdbUrl(spy).pathname).toBe("/3/discover/tv");
    expect(params(spy)).toEqual([
      ["language", "en-US"],
      ["include_adult", "false"],
      ["with_genres", "10765"],
      ["without_genres", "10767"],
      ["vote_average.gte", "8"],
      ["with_original_language", "ja"],
      ["sort_by", "vote_average.desc"],
      ["vote_count.gte", "100"],
    ]);
  });

  test("empty id lists aren't sent", async () => {
    const spy = mockSearch();
    await discoverTitles({
      type: "movie",
      sort: "popular",
      genreIds: [],
      withoutGenreIds: [],
      castIds: [],
      crewIds: [],
    });

    expect(params(spy)).toEqual([
      ["language", "en-US"],
      ["include_adult", "false"],
      ["sort_by", "popularity.desc"],
    ]);
  });

  // /discover/tv ignores with_cast / with_crew and answers unfiltered titles
  it.each([{ castIds: [287] }, { crewIds: [138] }])(
    "TV with %j throws, no request",
    async (people) => {
      const spy = mockSearch();
      await expect(
        discoverTitles({ type: "tv", sort: "popular", ...people }),
      ).rejects.toThrow("movies only");
      expect(spy).not.toHaveBeenCalled();
    },
  );

  test("TV with empty cast and crew lists: no filter, no error", async () => {
    const spy = mockSearch();
    await discoverTitles({
      type: "tv",
      sort: "popular",
      castIds: [],
      crewIds: [],
    });
    expect(spy).toHaveBeenCalledOnce();
  });
});

// trending, recommendations, similar and credits carry these
const rawTitle = (id: number, extra: object = {}) => ({
  id,
  title: `Movie ${id}`,
  name: `Show ${id}`,
  release_date: "2014-10-15",
  first_air_date: "2017-12-01",
  vote_average: 7.5,
  vote_count: 900,
  genre_ids: [18],
  ...extra,
});

describe("searchPeople", () => {
  test("searches people in English, adult left out", async () => {
    const spy = mockTmdb({ "/3/search/person": EMPTY });
    await searchPeople("Brad Pitt");

    expect(lastTmdbUrl(spy).pathname).toBe("/3/search/person");
    expect(params(spy)).toEqual([
      ["query", "Brad Pitt"],
      ["language", "en-US"],
      ["include_adult", "false"],
    ]);
  });

  test("known_for: movies and TV mixed, other items dropped", async () => {
    mockTmdb({
      "/3/search/person": {
        page: 1,
        total_pages: 3,
        total_results: 45,
        results: [
          {
            id: 287,
            name: "Brad Pitt",
            known_for_department: "Acting",
            popularity: 20,
            known_for: [
              { media_type: "movie", ...rawTitle(550) },
              { media_type: "tv", ...rawTitle(1399) },
              { media_type: "person", id: 1, name: "Not a title" },
            ],
          },
          { id: 2, name: "Bare" },
        ],
      },
    });

    expect(await searchPeople("x")).toEqual({
      page: 1,
      totalPages: 3,
      totalResults: 45,
      results: [
        {
          id: 287,
          name: "Brad Pitt",
          department: "Acting",
          knownFor: [
            { type: "movie", title: "Movie 550", releaseDate: "2014-10-15" },
            { type: "tv", title: "Show 1399", releaseDate: "2017-12-01" },
          ],
        },
        { id: 2, name: "Bare", department: "", knownFor: [] },
      ],
    });
  });
});

describe("getTrending", () => {
  it.each([
    ["movie", "day"],
    ["movie", "week"],
    ["tv", "day"],
    ["tv", "week"],
  ] as const)("%s, %s", async (type, window) => {
    const spy = mockTmdb({ [`/3/trending/${type}/${window}`]: EMPTY });
    await getTrending(type, window);

    expect(lastTmdbUrl(spy).pathname).toBe(`/3/trending/${type}/${window}`);
    expect(params(spy)).toEqual([["language", "en-US"]]);
  });

  test("hits keep the adult flag, false when missing", async () => {
    mockTmdb({
      "/3/trending/tv/week": {
        ...EMPTY,
        results: [
          rawTitle(1, { media_type: "tv", adult: true }),
          rawTitle(2, { media_type: "tv" }),
        ],
      },
    });
    const { results } = await getTrending("tv", "week");
    expect(results).toEqual([
      expect.objectContaining({ id: 1, title: "Show 1", adult: true }),
      expect.objectContaining({ id: 2, title: "Show 2", adult: false }),
    ]);
  });
});

describe.each([
  ["getRecommendations", getRecommendations, "recommendations"],
  ["getSimilarTitles", getSimilarTitles, "similar"],
] as const)("%s", (_, query, segment) => {
  it.each(["movie", "tv"] as const)("%s: path and language", async (type) => {
    const spy = mockTmdb({ [`/3/${type}/550/${segment}`]: EMPTY });
    await query(type, 550);

    expect(lastTmdbUrl(spy).pathname).toBe(`/3/${type}/550/${segment}`);
    expect(params(spy)).toEqual([["language", "en-US"]]);
  });

  // movie and TV ids overlap: the requested type decides the fields
  test("hits are mapped with the requested type", async () => {
    mockTmdb({
      [`/3/tv/1399/${segment}`]: {
        ...EMPTY,
        results: [rawTitle(66732, { media_type: "tv" })],
      },
    });
    const { results } = await query("tv", 1399);
    expect(results).toEqual([
      {
        id: 66732,
        title: "Show 66732",
        releaseDate: "2017-12-01",
        posterPath: null,
        backdropPath: null,
        voteAverage: 7.5,
        voteCount: 900,
        genreIds: [18],
        adult: false,
      },
    ]);
  });
});

describe("getPersonCredits", () => {
  it.each(["movie", "tv"] as const)("%s: path and language", async (type) => {
    const spy = mockTmdb({
      [`/3/person/287/${type}_credits`]: { cast: [], crew: [] },
    });
    await getPersonCredits(type, 287);

    expect(lastTmdbUrl(spy).pathname).toBe(`/3/person/287/${type}_credits`);
    expect(params(spy)).toEqual([["language", "en-US"]]);
  });

  test("movie: cast with character, crew with job", async () => {
    mockTmdb({
      "/3/person/287/movie_credits": {
        id: 287,
        cast: [
          rawTitle(228150, { character: "Don 'Wardaddy' Collier" }),
          rawTitle(1, { adult: true }),
        ],
        crew: [rawTitle(2, { job: "Producer", department: "Production" })],
      },
    });

    const { cast, crew } = await getPersonCredits("movie", 287);

    expect(cast).toEqual([
      expect.objectContaining({
        id: 228150,
        title: "Movie 228150",
        character: "Don 'Wardaddy' Collier",
        episodeCount: null,
        adult: false,
      }),
      expect.objectContaining({
        id: 1,
        character: "",
        episodeCount: null,
        adult: true,
      }),
    ]);
    expect(crew).toEqual([
      expect.objectContaining({ id: 2, job: "Producer", adult: false }),
    ]);
    expect(crew[0]).not.toHaveProperty("character");
  });

  test("TV: cast with the episode count", async () => {
    mockTmdb({
      "/3/person/287/tv_credits": {
        cast: [
          rawTitle(1399, { character: "Ned", episode_count: 9 }),
          rawTitle(2734, { character: "Himself", genre_ids: [10767] }),
        ],
        crew: [rawTitle(3, { job: "Executive Producer" })],
      },
    });

    const { cast, crew } = await getPersonCredits("tv", 287);

    expect(cast).toEqual([
      expect.objectContaining({
        title: "Show 1399",
        releaseDate: "2017-12-01",
        character: "Ned",
        episodeCount: 9,
      }),
      expect.objectContaining({
        character: "Himself",
        episodeCount: null,
        genreIds: [10767],
      }),
    ]);
    expect(crew).toEqual([
      expect.objectContaining({ title: "Show 3", job: "Executive Producer" }),
    ]);
  });
});

describe("getGenres", () => {
  // the cache lives in the module: a fresh copy per test
  const freshServer = async () => {
    vi.resetModules();
    return import("./server");
  };
  const GENRES = { genres: [{ id: 18, name: "Drama" }] };

  test("fetches the English list per media type", async () => {
    const { getGenres } = await freshServer();
    const spy = mockTmdb({ "/3/genre/tv/list": GENRES });

    expect(await getGenres("tv")).toEqual(GENRES.genres);
    expect(lastTmdbUrl(spy).pathname).toBe("/3/genre/tv/list");
    expect(params(spy)).toEqual([["language", "en-US"]]);
  });

  test("is memoised per media type", async () => {
    const { getGenres } = await freshServer();
    const spy = mockTmdb({
      "/3/genre/movie/list": GENRES,
      "/3/genre/tv/list": { genres: [{ id: 10765, name: "Sci-Fi & Fantasy" }] },
    });

    await getGenres("movie");
    expect(await getGenres("movie")).toEqual(GENRES.genres);
    expect(spy).toHaveBeenCalledTimes(1);

    expect(await getGenres("tv")).toEqual([
      { id: 10765, name: "Sci-Fi & Fantasy" },
    ]);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test("parallel calls share one request", async () => {
    const { getGenres } = await freshServer();
    const spy = mockTmdb({ "/3/genre/movie/list": GENRES });

    const lists = await Promise.all([1, 2, 3].map(() => getGenres("movie")));

    expect(lists).toEqual([GENRES.genres, GENRES.genres, GENRES.genres]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("a failure isn't cached: the next call retries", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { getGenres } = await freshServer();
    let fail = true;
    const spy = mockTmdb({
      "/3/genre/movie/list": () =>
        fail ? new Response("boom", { status: 503 }) : GENRES,
    });

    await expect(getGenres("movie")).rejects.toMatchObject({ status: 503 });
    fail = false;
    expect(await getGenres("movie")).toEqual(GENRES.genres);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("getTitleWithCredits", () => {
  const credits = {
    cast: [
      { name: "Third", order: 2 },
      { name: "First", order: 0 },
      { name: "Second", order: 1 },
    ],
  };

  test("one request: details with credits, cast in billing order", async () => {
    const spy = mockTmdb({
      "/3/movie/550": { ...tmdbFixture<object>("movie-550"), credits },
    });
    const title = await getTitleWithCredits("movie", 550);

    expect(spy).toHaveBeenCalledOnce();
    expect(params(spy)).toEqual([
      ["language", "en-US"],
      ["append_to_response", "credits"],
    ]);
    expect(title).toMatchObject({
      mediaType: "movie",
      title: "Fight Club",
      runtime: 139,
      cast: ["First", "Second", "Third"],
      episodeRuntime: null,
    });
  });

  test("TV: the first episode runtime", async () => {
    mockTmdb({
      "/3/tv/1399": {
        ...tmdbFixture<object>("tv-1399"),
        credits,
        episode_run_time: [55, 60],
      },
    });
    const title = await getTitleWithCredits("tv", 1399);
    expect(title).toMatchObject({
      mediaType: "tv",
      numberOfSeasons: 8,
      episodeRuntime: 55,
    });
  });

  test("no credits or episode runtimes: empty cast and null", async () => {
    mockTmdb({
      "/3/tv/1399": { ...tmdbFixture<object>("tv-1399"), episode_run_time: [] },
    });
    const title = await getTitleWithCredits("tv", 1399);
    expect(title.cast).toEqual([]);
    expect(title.episodeRuntime).toBeNull();
  });
});

describe("abort signal", () => {
  it.each([
    [
      "searchTitlesByYear",
      (o: { signal: AbortSignal }) =>
        searchTitlesByYear({ type: "movie", query: "x" }, o),
    ],
    [
      "discoverTitles",
      (o: { signal: AbortSignal }) =>
        discoverTitles({ type: "tv", sort: "popular" }, o),
    ],
    [
      "getTitleWithCredits",
      (o: { signal: AbortSignal }) => getTitleWithCredits("movie", 550, o),
    ],
    [
      "searchPeople",
      (o: { signal: AbortSignal }) => searchPeople("Brad Pitt", o),
    ],
    [
      "getTrending",
      (o: { signal: AbortSignal }) => getTrending("movie", "week", o),
    ],
    [
      "getRecommendations",
      (o: { signal: AbortSignal }) => getRecommendations("movie", 550, o),
    ],
    [
      "getSimilarTitles",
      (o: { signal: AbortSignal }) => getSimilarTitles("movie", 550, o),
    ],
    [
      "getPersonCredits",
      (o: { signal: AbortSignal }) => getPersonCredits("tv", 287, o),
    ],
  ])("%s passes it to fetch", async (_, call) => {
    const spy = mockTmdb({
      "/3/search/movie": EMPTY,
      "/3/discover/tv": EMPTY,
      "/3/movie/550": tmdbFixture("movie-550"),
      "/3/search/person": EMPTY,
      "/3/trending/movie/week": EMPTY,
      "/3/movie/550/recommendations": EMPTY,
      "/3/movie/550/similar": EMPTY,
      "/3/person/287/tv_credits": { cast: [], crew: [] },
    });
    const { signal } = new AbortController();

    await call({ signal });

    expect(init(spy).signal).toBe(signal);
  });

  test("getGenres passes it to fetch", async () => {
    vi.resetModules();
    const { getGenres } = await import("./server");
    const spy = mockTmdb({ "/3/genre/movie/list": { genres: [] } });
    const { signal } = new AbortController();

    await getGenres("movie", { signal });

    expect(init(spy).signal).toBe(signal);
  });

  test("an aborted request rethrows the reason without logging", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mockTmdb({ "/3/search/movie": hangUntilAborted });
    const controller = new AbortController();

    const request = searchTitlesByYear(
      { type: "movie", query: "x" },
      { signal: controller.signal },
    );
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(log).not.toHaveBeenCalled();
  });

  test("a failure with a live signal is still logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mockTmdb({ "/3/search/movie": new Response("x", { status: 500 }) });

    await expect(
      searchTitlesByYear(
        { type: "movie", query: "x" },
        { signal: new AbortController().signal },
      ),
    ).rejects.toBeInstanceOf(TmdbError);
    expect(log).toHaveBeenCalledOnce();
  });
});
