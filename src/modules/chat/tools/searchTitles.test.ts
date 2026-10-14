import { beforeEach, describe, expect, test, vi } from "vitest";
import { makeMovie } from "@test/helpers/factories";
import { mockTmdb, tmdbUrls } from "@test/helpers/tmdb";
import {
  MOVIE_GENRES,
  TV_GENRES,
  page,
  rawMovie,
  rawShow,
} from "../testing/tmdbData";
import { listContext, toolContext } from "../testing/toolContext";

// fresh module per test: the genre list is cached at module level
let searchTitles: typeof import("./searchTitles").searchTitles;
beforeEach(async () => {
  vi.resetModules();
  ({ searchTitles } = await import("./searchTitles"));
});

// handlers return plain JSON for the model
type Items = { results: Record<string, unknown>[] };
const search = async (args: Parameters<typeof searchTitles.run>[0]) =>
  (await searchTitles.run(args, toolContext())) as Items;

const mockSearch = (movies: object[], shows: object[] = []) =>
  mockTmdb({
    "/3/search/movie": page(movies),
    "/3/search/tv": page(shows),
    "/3/genre/movie/list": MOVIE_GENRES,
    "/3/genre/tv/list": TV_GENRES,
  });

describe("search_titles", () => {
  test("returns the top 5 hits with only the listed fields", async () => {
    mockSearch([1, 2, 3, 4, 5, 6, 7].map((id) => rawMovie(id)));

    const { results } = await search({ query: "Fury", type: "movie" });

    expect(results).toHaveLength(5);
    expect(results.map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
    expect(results[0]).toEqual({
      id: 1,
      type: "movie",
      title: "Movie 1",
      year: 2014,
      rating: 7.5,
      votes: 1234,
      genres: ["War", "Drama"],
    });
  });

  test("TV: name, first air year and the TV genre list", async () => {
    mockSearch([], [rawShow(70523, { genre_ids: [10765, 18] })]);

    const { results } = await search({ query: "Dark", type: "tv" });

    expect(results).toEqual([
      {
        id: 70523,
        type: "tv",
        title: "Show 70523",
        year: 2017,
        rating: 8,
        votes: 50,
        genres: ["Sci-Fi & Fantasy", "Drama"],
      },
    ]);
  });

  test("unknown genre ids are dropped, a missing date gives a null year", async () => {
    mockSearch([rawMovie(1, { genre_ids: [18, 999], release_date: "" })]);

    const { results } = await search({ query: "x", type: "movie" });

    expect(results[0]).toMatchObject({ year: null, genres: ["Drama"] });
  });

  test("the year goes to the per-type param", async () => {
    const spy = mockSearch([]);

    await searchTitles.run(
      { query: "Fury", type: "movie", year: 2014 },
      toolContext(),
    );
    await searchTitles.run(
      { query: "Dark", type: "tv", year: 2017 },
      toolContext(),
    );

    const [movie] = tmdbUrls(spy, "/3/search/movie");
    const [tv] = tmdbUrls(spy, "/3/search/tv");
    expect(movie.searchParams.get("primary_release_year")).toBe("2014");
    expect(movie.searchParams.get("query")).toBe("Fury");
    expect(tv.searchParams.get("first_air_date_year")).toBe("2017");
    expect(tv.searchParams.get("query")).toBe("Dark");
  });

  test("a failed genre list still returns the hits, without genres", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockTmdb({
      "/3/search/movie": page([rawMovie(1)]),
      "/3/genre/movie/list": new Response("boom", { status: 503 }),
    });

    const { results } = await search({ query: "Fury", type: "movie" });

    expect(results).toEqual([expect.objectContaining({ id: 1, genres: [] })]);
  });

  test("no matches: an empty list", async () => {
    mockSearch([]);
    expect(
      await searchTitles.run({ query: "zzz", type: "movie" }, toolContext()),
    ).toEqual({ results: [] });
  });

  // the genre list is one request shared across chats: it never gets a
  // caller's signal (see getGenres)
  test("passes the signal to the search, not to the shared genre list", async () => {
    const spy = mockSearch([rawMovie(1)]);
    const { signal } = new AbortController();

    await searchTitles.run(
      { query: "Fury", type: "movie" },
      toolContext(signal),
    );

    expect(spy).toHaveBeenCalledTimes(2);
    for (const [input, init] of spy.mock.calls) {
      const isGenres = String(input).includes("/genre/");
      expect(init?.signal === signal).toBe(!isGenres);
    }
  });

  test("args: query 1-100 chars, a movie/tv type and an integer year", () => {
    const parse = (args: object) => searchTitles.args.safeParse(args).success;

    expect(parse({ query: "Fury", type: "movie" })).toBe(true);
    expect(parse({ query: "a".repeat(100), type: "tv", year: 2014 })).toBe(
      true,
    );
    expect(parse({ query: "", type: "movie" })).toBe(false);
    expect(parse({ query: "a".repeat(101), type: "movie" })).toBe(false);
    expect(parse({ query: "Fury", type: "film" })).toBe(false);
    expect(parse({ query: "Fury", type: "movie", year: 2014.5 })).toBe(false);
    expect(parse({ type: "movie" })).toBe(false);
  });
});

describe("search_titles: inList", () => {
  const searchAs = async (ctx: ReturnType<typeof toolContext>) =>
    (await searchTitles.run({ query: "Fury", type: "movie" }, ctx)) as Items;

  test("a listed title gets its status, an unlisted one no key", async () => {
    mockSearch([rawMovie(1), rawMovie(2)]);

    const { results } = await searchAs(
      listContext([
        makeMovie({ movieId: 1, status: "Planning to watch" }),
        // the same id as TV: not this movie
        makeMovie({ movieId: 2, type: "tv" }),
      ]),
    );

    expect(results[0]).toHaveProperty("inList", "Planning to watch");
    expect(results[1]).not.toHaveProperty("inList");
  });

  test("signed out: no marks", async () => {
    mockSearch([rawMovie(1)]);

    const { results } = await searchAs(toolContext());

    expect(results[0]).not.toHaveProperty("inList");
  });

  test("a failed list read still returns the hits, without marks", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockSearch([rawMovie(1)]);

    const { results } = await searchAs(
      listContext(() => Promise.reject(new Error("db down"))),
    );

    expect(results).toEqual([expect.objectContaining({ id: 1 })]);
    expect(results[0]).not.toHaveProperty("inList");
  });
});
