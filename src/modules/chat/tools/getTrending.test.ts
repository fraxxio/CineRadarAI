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
let getTrending: typeof import("./getTrending").getTrending;
beforeEach(async () => {
  vi.resetModules();
  ({ getTrending } = await import("./getTrending"));
});

// handlers return plain JSON for the model
type Items = { results: Record<string, unknown>[] };

// args as the registry passes them: parsed, defaults applied
const run = async (args: object, signal = new AbortController().signal) =>
  (await getTrending.run(getTrending.args.parse(args), { signal })) as Items;

// trending items carry media_type, like TMDB sends them
const movie = (id: number, extra: object = {}) =>
  rawMovie(id, { media_type: "movie", adult: false, ...extra });
const show = (id: number, extra: object = {}) =>
  rawShow(id, { media_type: "tv", adult: false, ...extra });

const mockTrending = (movies: object[], shows: object[] = []) =>
  mockTmdb({
    "/3/trending/movie/day": page(movies),
    "/3/trending/movie/week": page(movies),
    "/3/trending/tv/day": page(shows),
    "/3/trending/tv/week": page(shows),
    "/3/genre/movie/list": MOVIE_GENRES,
    "/3/genre/tv/list": TV_GENRES,
  });

const ids = (items: Items) => items.results.map((r) => r.id);

describe("get_trending", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("movies: only the listed fields", async () => {
    mockTrending([movie(550)]);

    const { results } = await run({ type: "movie" });

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

  test("TV: name, first air year and the TV genre list", async () => {
    mockTrending([], [show(1399, { genre_ids: [10765, 18] })]);

    const { results } = await run({ type: "tv" });

    expect(results).toEqual([
      {
        id: 1399,
        type: "tv",
        title: "Show 1399",
        year: 2017,
        rating: 8,
        votes: 50,
        genres: ["Sci-Fi & Fantasy", "Drama"],
      },
    ]);
  });

  test("keeps TMDB's order, the top 10 counted after filtering", async () => {
    mockTrending([
      // TMDB trends upcoming titles: dropped before the limit
      movie(101, { release_date: "2027-01-01" }),
      ...Array.from({ length: 12 }, (_, i) => movie(20 - i, { vote_count: i })),
    ]);

    const items = await run({ type: "movie" });

    expect(ids(items)).toEqual(Array.from({ length: 10 }, (_, i) => 20 - i));
  });

  test("unreleased, undated and adult titles are dropped", async () => {
    mockTrending([
      movie(1),
      movie(2, { release_date: "2026-06-02" }),
      movie(3, { release_date: "" }),
      movie(4, { adult: true }),
      // released today
      movie(5, { release_date: "2026-06-01" }),
    ]);

    expect(ids(await run({ type: "movie" }))).toEqual([1, 5]);
  });

  test("asks the path of the type and window, week by default", async () => {
    const spy = mockTrending([]);

    await run({ type: "movie" });
    await run({ type: "tv", window: "day" });

    expect(tmdbUrls(spy, "/3/trending/movie/week")).toHaveLength(1);
    expect(tmdbUrls(spy, "/3/trending/tv/day")).toHaveLength(1);
    expect(getTrending.args.parse({ type: "tv" })).toEqual({
      type: "tv",
      window: "week",
    });
  });

  test("a failed genre list still returns the titles, without genres", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockTmdb({
      "/3/trending/movie/week": page([movie(1)]),
      "/3/genre/movie/list": new Response("boom", { status: 503 }),
    });

    const { results } = await run({ type: "movie" });

    expect(results).toEqual([expect.objectContaining({ id: 1, genres: [] })]);
  });

  test("nothing trending: an empty list", async () => {
    mockTrending([]);
    expect(await run({ type: "movie" })).toEqual({ results: [] });
  });

  test("passes the signal to every TMDB request", async () => {
    const spy = mockTrending([movie(1)]);
    const { signal } = new AbortController();

    await run({ type: "movie" }, signal);

    // the trending list and the genre list
    expect(spy).toHaveBeenCalledTimes(2);
    for (const [, init] of spy.mock.calls) {
      expect(init?.signal).toBe(signal);
    }
  });

  test("args: a movie/tv type and a day/week window", () => {
    const parse = (args: object) => getTrending.args.safeParse(args).success;

    expect(parse({ type: "movie", window: "day" })).toBe(true);
    expect(parse({ type: "tv", window: "week" })).toBe(true);
    expect(parse({ type: "movie", window: "month" })).toBe(false);
    expect(parse({ type: "film" })).toBe(false);
    expect(parse({})).toBe(false);
  });
});
