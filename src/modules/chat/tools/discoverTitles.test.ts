import { beforeEach, describe, expect, it, test, vi } from "vitest";
import { mockTmdb, tmdbUrls } from "@test/helpers/tmdb";
import {
  MOVIE_GENRES,
  TV_GENRES,
  page,
  rawMovie,
  rawShow,
} from "../testing/tmdbData";

// fresh modules per test: the genre list is cached at module level
let discoverTitles: typeof import("./discoverTitles").discoverTitles;
let ToolError: typeof import("./types").ToolError;
beforeEach(async () => {
  vi.resetModules();
  ({ discoverTitles } = await import("./discoverTitles"));
  ({ ToolError } = await import("./types"));
});

const ctx = () => ({ signal: new AbortController().signal });

// handlers return plain JSON for the model
type Items = { results: Record<string, unknown>[] };

const mockDiscover = (movies: object[] = [], shows: object[] = []) =>
  mockTmdb({
    "/3/discover/movie": page(movies),
    "/3/discover/tv": page(shows),
    "/3/genre/movie/list": MOVIE_GENRES,
    "/3/genre/tv/list": TV_GENRES,
  });

// args as the registry passes them: parsed, defaults applied
const run = async (args: object, signal = new AbortController().signal) =>
  (await discoverTitles.run(discoverTitles.args.parse(args), {
    signal,
  })) as Items;

const discoverUrl = (spy: ReturnType<typeof mockTmdb>, type = "movie") =>
  tmdbUrls(spy, `/3/discover/${type}`)[0];

describe("discover_titles", () => {
  test("returns the top 10 with only the listed fields", async () => {
    mockDiscover(Array.from({ length: 12 }, (_, i) => rawMovie(i + 1)));

    const { results } = await run({ type: "movie" });

    expect(results.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
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

  test("TV items use the TV genre list", async () => {
    mockDiscover([], [rawShow(1)]);
    const { results } = await run({ type: "tv" });
    expect(results[0]).toMatchObject({
      type: "tv",
      title: "Show 1",
      genres: ["Sci-Fi & Fantasy"],
    });
  });

  test("sorts by popularity by default", async () => {
    const spy = mockDiscover();
    await run({ type: "movie" });
    expect(discoverUrl(spy).searchParams.get("sort_by")).toBe(
      "popularity.desc",
    );
    expect(discoverUrl(spy).searchParams.has("vote_count.gte")).toBe(false);
  });

  it.each([
    ["movie", "200"],
    ["tv", "100"],
  ])("top_rated %s: by rating, at least %s votes", async (type, floor) => {
    const spy = mockDiscover();
    await run({ type, sort: "top_rated" });
    const params = discoverUrl(spy, type).searchParams;
    expect(params.get("sort_by")).toBe("vote_average.desc");
    expect(params.get("vote_count.gte")).toBe(floor);
  });

  test("the year goes to the per-type param", async () => {
    const spy = mockDiscover();

    await run({ type: "movie", year: 2026 });
    await run({ type: "tv", year: 2026 });

    const movie = discoverUrl(spy, "movie").searchParams;
    const tv = discoverUrl(spy, "tv").searchParams;
    expect(movie.get("primary_release_year")).toBe("2026");
    expect(movie.has("first_air_date_year")).toBe(false);
    expect(tv.get("first_air_date_year")).toBe("2026");
    expect(tv.has("primary_release_year")).toBe(false);
  });

  it.each(["Science Fiction", "science fiction", "  SCIENCE FICTION "])(
    "genre %j maps to its id",
    async (genre) => {
      const spy = mockDiscover();
      await run({ type: "movie", genre });
      expect(discoverUrl(spy).searchParams.get("with_genres")).toBe("878");
    },
  );

  test("no genre: no genre filter", async () => {
    const spy = mockDiscover();
    await run({ type: "movie" });
    expect(discoverUrl(spy).searchParams.has("with_genres")).toBe(false);
  });

  test("an unknown genre throws a ToolError naming the valid ones", async () => {
    const spy = mockDiscover();

    const error = await run({ type: "tv", genre: "Science Fiction" }).catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(ToolError);
    expect(error.message).toBe(
      'Unknown genre "Science Fiction". Valid tv genres: Drama, Sci-Fi & Fantasy',
    );
    // nothing discovered with a wrong filter
    expect(tmdbUrls(spy, "/3/discover/tv")).toEqual([]);
  });

  test("passes the signal to every TMDB request", async () => {
    const spy = mockDiscover();
    const { signal } = new AbortController();

    await run({ type: "movie", genre: "War" }, signal);

    // the genre list and the discover request
    expect(spy).toHaveBeenCalledTimes(2);
    for (const [, init] of spy.mock.calls) {
      expect(init?.signal).toBe(signal);
    }
  });
});
