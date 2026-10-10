import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mockTmdb, tmdbUrls } from "@test/helpers/tmdb";
import {
  MOVIE_GENRES,
  TV_GENRES,
  page,
  rawMovie,
  rawShow,
} from "../testing/tmdbData";

// fresh module per test: the genre list is cached at module level
let getRecommendations: typeof import("./getRecommendations").getRecommendations;
beforeEach(async () => {
  vi.resetModules();
  ({ getRecommendations } = await import("./getRecommendations"));
});

// handlers return plain JSON for the model
type Items = { results: Record<string, unknown>[] };

const run = async (args: object, signal = new AbortController().signal) =>
  (await getRecommendations.run(getRecommendations.args.parse(args), {
    signal,
  })) as Items;

// movie and TV ids overlap: 1399 is a movie and a show
const mockList = (movies: object[], shows: object[] = []) =>
  mockTmdb({
    "/3/movie/1399/recommendations": page(movies),
    "/3/tv/1399/recommendations": page(shows),
    "/3/genre/movie/list": MOVIE_GENRES,
    "/3/genre/tv/list": TV_GENRES,
  });

const ids = (items: Items) => items.results.map((r) => r.id);

describe("get_recommendations", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("movies: only the listed fields", async () => {
    mockList([rawMovie(550, { adult: false })]);

    const { results } = await run({ type: "movie", id: 1399 });

    expect(results).toEqual([
      {
        id: 550,
        type: "movie",
        title: "Movie 550",
        year: 2014,
        rating: 7.5,
        votes: 1234,
        genres: ["War", "Drama"],
      },
    ]);
  });

  test("the same id as TV asks the TV path and maps shows", async () => {
    const spy = mockList([rawMovie(550)], [rawShow(66732)]);

    const { results } = await run({ type: "tv", id: 1399 });

    expect(results).toEqual([
      {
        id: 66732,
        type: "tv",
        title: "Show 66732",
        year: 2017,
        rating: 8,
        votes: 50,
        genres: ["Sci-Fi & Fantasy"],
      },
    ]);
    expect(tmdbUrls(spy, "/3/tv/1399/recommendations")).toHaveLength(1);
    expect(tmdbUrls(spy, "/3/movie/1399/recommendations")).toHaveLength(0);
  });

  test("keeps TMDB's order, the top 10 counted after filtering", async () => {
    mockList([
      // the title itself and an upcoming one: dropped before the limit
      rawMovie(1399),
      rawMovie(101, { release_date: "2027-01-01" }),
      ...Array.from({ length: 12 }, (_, i) =>
        rawMovie(20 - i, { vote_count: i }),
      ),
    ]);

    const items = await run({ type: "movie", id: 1399 });

    expect(ids(items)).toEqual(Array.from({ length: 10 }, (_, i) => 20 - i));
  });

  test("the title itself, unreleased, undated and adult titles are dropped", async () => {
    mockList([
      rawMovie(1),
      rawMovie(1399),
      rawMovie(2, { release_date: "2026-06-02" }),
      rawMovie(3, { release_date: "" }),
      rawMovie(4, { adult: true }),
      // released today
      rawMovie(5, { release_date: "2026-06-01" }),
    ]);

    expect(ids(await run({ type: "movie", id: 1399 }))).toEqual([1, 5]);
  });

  test("no recommendations: an empty list", async () => {
    mockList([]);
    expect(await run({ type: "movie", id: 1399 })).toEqual({ results: [] });
  });

  test("a failed genre list still returns the titles, without genres", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockTmdb({
      "/3/movie/1399/recommendations": page([rawMovie(1)]),
      "/3/genre/movie/list": new Response("boom", { status: 503 }),
    });

    const { results } = await run({ type: "movie", id: 1399 });

    expect(results).toEqual([expect.objectContaining({ id: 1, genres: [] })]);
  });

  test("passes the signal to every TMDB request", async () => {
    const spy = mockList([rawMovie(1)]);
    const { signal } = new AbortController();

    await run({ type: "movie", id: 1399 }, signal);

    // the list and the genre list
    expect(spy).toHaveBeenCalledTimes(2);
    for (const [, init] of spy.mock.calls) {
      expect(init?.signal).toBe(signal);
    }
  });

  test("args: a movie/tv type and a positive integer id", () => {
    const parse = (args: object) =>
      getRecommendations.args.safeParse(args).success;

    expect(parse({ type: "tv", id: 1399 })).toBe(true);
    expect(parse({ type: "movie", id: 0 })).toBe(false);
    expect(parse({ type: "movie", id: 2.5 })).toBe(false);
    expect(parse({ type: "film", id: 1399 })).toBe(false);
    expect(parse({ type: "movie" })).toBe(false);
  });
});
