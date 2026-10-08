import { describe, expect, it, test, vi } from "vitest";
import {
  TmdbError,
  discoverTitles,
  findTitles,
  getLanguages,
  getTitle,
  getTitleImages,
  getTitleReviews,
  getTitleVideos,
  getTitleWithCredits,
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
    await discoverTitles({ type: "movie", year: 2026, sort: "popular" });

    expect(lastTmdbUrl(spy).pathname).toBe("/3/discover/movie");
    expect(params(spy)).toEqual([
      ["language", "en-US"],
      ["include_adult", "false"],
      ["primary_release_year", "2026"],
      ["sort_by", "popularity.desc"],
    ]);
  });

  it.each([
    ["movie", "200", "primary_release_year"],
    ["tv", "100", "first_air_date_year"],
  ] as const)(
    "top_rated %s: by rating with a vote floor of %s",
    async (type, floor, yearKey) => {
      const spy = mockSearch();
      await discoverTitles({
        type,
        year: 2020,
        genreId: 18,
        sort: "top_rated",
      });

      expect(lastTmdbUrl(spy).pathname).toBe(`/3/discover/${type}`);
      expect(params(spy)).toEqual([
        ["language", "en-US"],
        ["include_adult", "false"],
        ["with_genres", "18"],
        [yearKey, "2020"],
        ["sort_by", "vote_average.desc"],
        ["vote_count.gte", floor],
      ]);
    },
  );
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
  ])("%s passes it to fetch", async (_, call) => {
    const spy = mockTmdb({
      "/3/search/movie": EMPTY,
      "/3/discover/tv": EMPTY,
      "/3/movie/550": tmdbFixture("movie-550"),
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
