import { describe, expect, it, test, vi } from "vitest";
import {
  TmdbError,
  findTitles,
  getLanguages,
  getTitle,
  getTitleImages,
  getTitleReviews,
  getTitleVideos,
} from "./server";
import { lastTmdbUrl, mockTmdb, tmdbFixture } from "@test/helpers/tmdb";

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
