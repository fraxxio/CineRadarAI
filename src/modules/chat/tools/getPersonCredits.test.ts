import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mockTmdb, tmdbUrls } from "@test/helpers/tmdb";
import {
  MOVIE_GENRES,
  TV_GENRES,
  rawMovie,
  rawShow,
} from "../testing/tmdbData";

// fresh module per test: the genre list is cached at module level
let getPersonCredits: typeof import("./getPersonCredits").getPersonCredits;
beforeEach(async () => {
  vi.resetModules();
  ({ getPersonCredits } = await import("./getPersonCredits"));
});

// handlers return plain JSON for the model
type Items = { results: Record<string, unknown>[] };

// args as the registry passes them: parsed, defaults applied
const run = async (args: object, signal = new AbortController().signal) =>
  (await getPersonCredits.run(getPersonCredits.args.parse(args), {
    signal,
  })) as Items;

const credits = (cast: object[], crew: object[] = []) => ({
  id: 287,
  cast,
  crew,
});

const mockCredits = (movie: ReturnType<typeof credits>, tv = credits([])) =>
  mockTmdb({
    "/3/person/287/movie_credits": movie,
    "/3/person/287/tv_credits": tv,
    "/3/genre/movie/list": MOVIE_GENRES,
    "/3/genre/tv/list": TV_GENRES,
  });

const ids = (items: Items) => items.results.map((r) => r.id);

describe("get_person_credits", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("movie cast: only the listed fields and the character", async () => {
    mockCredits(credits([rawMovie(16869, { character: "Lt. Aldo Raine" })]));

    const { results } = await run({ id: 287, type: "movie" });

    expect(results).toEqual([
      {
        id: 16869,
        type: "movie",
        title: "Movie 16869",
        year: 2014,
        rating: 7.5,
        votes: 1234,
        genres: ["War", "Drama"],
        character: "Lt. Aldo Raine",
      },
    ]);
  });

  test("TV cast: the TV genre list and the episode count", async () => {
    mockCredits(
      credits([]),
      credits([rawShow(1399, { character: "Jon", episode_count: 62 })]),
    );

    const { results } = await run({ id: 287, type: "tv" });

    expect(results).toEqual([
      {
        id: 1399,
        type: "tv",
        title: "Show 1399",
        year: 2017,
        rating: 8,
        votes: 50,
        genres: ["Sci-Fi & Fantasy"],
        character: "Jon",
        episodes: 62,
      },
    ]);
  });

  test("most voted first, the top 20 counted after filtering", async () => {
    mockCredits(
      credits([
        // upcoming titles with the most votes: dropped before the limit
        ...[101, 102, 103].map((id) =>
          rawMovie(id, { vote_count: 99999, release_date: "2027-01-01" }),
        ),
        ...Array.from({ length: 25 }, (_, i) =>
          rawMovie(i + 1, { vote_count: (i + 1) * 10 }),
        ),
      ]),
    );

    const items = await run({ id: 287, type: "movie" });

    expect(ids(items)).toEqual(Array.from({ length: 20 }, (_, i) => 25 - i));
  });

  test("cast: unreleased, undated, adult and self appearances are dropped", async () => {
    mockCredits(
      credits([
        rawMovie(1, { character: "Tyler Durden" }),
        rawMovie(2, { release_date: "2026-06-02" }),
        rawMovie(3, { release_date: "" }),
        rawMovie(4, { adult: true }),
        rawMovie(5, { character: "Self" }),
        rawMovie(6, { character: "Himself - Host" }),
        rawMovie(7, { character: "herself (archive footage)" }),
        // a character name, not a self appearance
        rawMovie(8, { character: "Selfridge" }),
        // released today
        rawMovie(9, { release_date: "2026-06-01" }),
      ]),
    );

    expect(ids(await run({ id: 287, type: "movie" }))).toEqual([1, 8, 9]);
  });

  test("TV cast: talk and news shows are dropped", async () => {
    mockCredits(
      credits([]),
      credits([
        rawShow(1, { character: "Jon" }),
        // guest spots on talk and news shows
        rawShow(2, { character: "Guest", genre_ids: [10767] }),
        rawShow(3, { character: "Guest", genre_ids: [35, 10763] }),
      ]),
    );

    expect(ids(await run({ id: 287, type: "tv" }))).toEqual([1]);
  });

  test("cast: two roles in one title give one item, the first role", async () => {
    mockCredits(
      credits([
        rawMovie(1, { character: "Sherman Klump" }),
        rawMovie(1, { character: "Buddy Love" }),
      ]),
    );

    const { results } = await run({ id: 287, type: "movie" });

    expect(results).toEqual([
      expect.objectContaining({ id: 1, character: "Sherman Klump" }),
    ]);
  });

  test("crew: one item per title with its jobs merged, most voted first", async () => {
    mockCredits(
      credits(
        [rawMovie(99, { character: "Cliff Booth" })],
        [
          rawMovie(1, { job: "Producer", vote_count: 100 }),
          rawMovie(2, { job: "Director", vote_count: 500 }),
          rawMovie(1, { job: "Director", vote_count: 100 }),
          rawMovie(2, { job: "Writer", vote_count: 500 }),
          rawMovie(2, { job: "Director", vote_count: 500 }),
          rawMovie(3, { job: "Director", release_date: "2027-03-01" }),
          rawMovie(4, { job: "Director", adult: true }),
        ],
      ),
    );

    const { results } = await run({ id: 287, type: "movie", role: "crew" });

    expect(results).toEqual([
      {
        id: 2,
        type: "movie",
        title: "Movie 2",
        year: 2014,
        rating: 7.5,
        votes: 500,
        genres: ["War", "Drama"],
        jobs: ["Director", "Writer"],
      },
      expect.objectContaining({ id: 1, jobs: ["Producer", "Director"] }),
    ]);
  });

  test("role defaults to cast", () => {
    expect(getPersonCredits.args.parse({ id: 287, type: "movie" })).toEqual({
      id: 287,
      type: "movie",
      role: "cast",
    });
  });

  test("asks the credits path of the type", async () => {
    const spy = mockCredits(credits([]));

    await run({ id: 287, type: "movie" });
    await run({ id: 287, type: "tv" });

    expect(tmdbUrls(spy, "/3/person/287/movie_credits")).toHaveLength(1);
    expect(tmdbUrls(spy, "/3/person/287/tv_credits")).toHaveLength(1);
  });

  test("a failed genre list still returns the credits, without genres", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockTmdb({
      "/3/person/287/movie_credits": credits([rawMovie(1)]),
      "/3/genre/movie/list": new Response("boom", { status: 503 }),
    });

    const { results } = await run({ id: 287, type: "movie" });

    expect(results).toEqual([expect.objectContaining({ id: 1, genres: [] })]);
  });

  test("passes the signal to every TMDB request", async () => {
    const spy = mockCredits(credits([rawMovie(1)]));
    const { signal } = new AbortController();

    await run({ id: 287, type: "movie" }, signal);

    // the credits and the genre list
    expect(spy).toHaveBeenCalledTimes(2);
    for (const [, init] of spy.mock.calls) {
      expect(init?.signal).toBe(signal);
    }
  });

  test("args: a positive integer id, a movie/tv type and a cast/crew role", () => {
    const parse = (args: object) =>
      getPersonCredits.args.safeParse(args).success;

    expect(parse({ id: 287, type: "tv", role: "crew" })).toBe(true);
    expect(parse({ id: 0, type: "movie" })).toBe(false);
    expect(parse({ id: 2.5, type: "movie" })).toBe(false);
    expect(parse({ id: 287, type: "film" })).toBe(false);
    expect(parse({ id: 287, type: "movie", role: "director" })).toBe(false);
    expect(parse({ type: "movie" })).toBe(false);
  });
});
