import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";
import { mockTmdb, tmdbUrls } from "@test/helpers/tmdb";
import {
  FULL_MOVIE_GENRES,
  FULL_TV_GENRES,
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

// handlers return plain JSON for the model
type Items = { results: Record<string, unknown>[] };

const mockDiscover = (movies: object[] = [], shows: object[] = []) =>
  mockTmdb({
    "/3/discover/movie": page(movies),
    "/3/discover/tv": page(shows),
    "/3/genre/movie/list": FULL_MOVIE_GENRES,
    "/3/genre/tv/list": FULL_TV_GENRES,
  });

// args as the registry passes them: parsed, defaults applied
const run = async (args: object, signal = new AbortController().signal) =>
  (await discoverTitles.run(discoverTitles.args.parse(args), {
    signal,
  })) as Items;

const discoverUrl = (spy: ReturnType<typeof mockTmdb>, type = "movie") =>
  tmdbUrls(spy, `/3/discover/${type}`)[0];

// the discover query without the params every request sends
const filters = (url: URL) =>
  [...url.searchParams].filter(
    ([key]) => key !== "language" && key !== "include_adult",
  );

const atDate = (iso: string) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
};

describe("discover_titles", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  test("no filters: popular titles released by today", async () => {
    atDate("2026-10-08T12:00:00Z");
    const spy = mockDiscover();

    await run({ type: "movie" });

    expect(filters(discoverUrl(spy))).toEqual([
      ["primary_release_date.lte", "2026-10-08"],
      ["sort_by", "popularity.desc"],
    ]);
  });

  // "highly rated sci-fi from the 2010s"
  test("the query of a typical call", async () => {
    const spy = mockDiscover();

    await run({
      type: "movie",
      genres: ["Science Fiction"],
      yearFrom: 2010,
      yearTo: 2019,
      sort: "top_rated",
    });

    expect(discoverUrl(spy).search).toBe(
      "?language=en-US&include_adult=false&with_genres=878&primary_release_date.gte=2010-01-01&primary_release_date.lte=2019-12-31&sort_by=vote_average.desc&vote_count.gte=200",
    );
  });

  test("every filter reaches the movie query", async () => {
    const spy = mockDiscover();

    await run({
      type: "movie",
      genres: ["War", "Drama"],
      excludeGenres: ["Comedy", "Animation"],
      yearFrom: 1990,
      yearTo: 1999,
      minRating: 7.5,
      minVotes: 50,
      withCast: [287, 1892],
      withCrew: [138],
      originalLanguage: "EN",
      sort: "newest",
    });

    expect(filters(discoverUrl(spy))).toEqual([
      ["with_genres", "10752,18"],
      ["without_genres", "35,16"],
      ["primary_release_date.gte", "1990-01-01"],
      ["primary_release_date.lte", "1999-12-31"],
      ["vote_average.gte", "7.5"],
      ["with_cast", "287,1892"],
      ["with_crew", "138"],
      ["with_original_language", "en"],
      ["sort_by", "primary_release_date.desc"],
      ["vote_count.gte", "50"],
    ]);
  });

  test("TV filters use TV genre ids and the first air date", async () => {
    const spy = mockDiscover();

    await run({
      type: "tv",
      genres: ["Science Fiction"],
      excludeGenres: ["Action", "Adventure", "Kids"],
      yearFrom: 2014,
      yearTo: 2014,
      originalLanguage: "ko",
      sort: "top_rated",
    });

    // Action + Adventure is one TV genre: sent once
    expect(filters(discoverUrl(spy, "tv"))).toEqual([
      ["with_genres", "10765"],
      ["without_genres", "10759,10762"],
      ["first_air_date.gte", "2014-01-01"],
      ["first_air_date.lte", "2014-12-31"],
      ["with_original_language", "ko"],
      ["sort_by", "vote_average.desc"],
      ["vote_count.gte", "100"],
    ]);
  });

  describe("release years", () => {
    test("only yearFrom: from that year up to today", async () => {
      atDate("2026-10-08T12:00:00Z");
      const spy = mockDiscover();

      await run({ type: "movie", yearFrom: 2020 });

      expect(filters(discoverUrl(spy))).toEqual(
        expect.arrayContaining([
          ["primary_release_date.gte", "2020-01-01"],
          ["primary_release_date.lte", "2026-10-08"],
        ]),
      );
    });

    test("only yearTo: up to the end of that year", async () => {
      const spy = mockDiscover();
      await run({ type: "tv", yearTo: 1999 });
      const params = discoverUrl(spy, "tv").searchParams;
      expect(params.has("first_air_date.gte")).toBe(false);
      expect(params.get("first_air_date.lte")).toBe("1999-12-31");
    });

    // upcoming titles rank high by popularity
    test("a yearTo in the future is capped at today", async () => {
      atDate("2026-10-08T23:59:00Z");
      const spy = mockDiscover();

      await run({ type: "movie", yearFrom: 2026, yearTo: 2027 });

      expect(filters(discoverUrl(spy))).toEqual(
        expect.arrayContaining([
          ["primary_release_date.gte", "2026-01-01"],
          ["primary_release_date.lte", "2026-10-08"],
        ]),
      );
    });

    // the empty list tells the model none are released yet
    test("a future yearFrom asks for an empty range", async () => {
      atDate("2026-10-08T12:00:00Z");
      const spy = mockDiscover();

      await run({ type: "movie", yearFrom: 2027 });

      expect(filters(discoverUrl(spy))).toEqual(
        expect.arrayContaining([
          ["primary_release_date.gte", "2027-01-01"],
          ["primary_release_date.lte", "2026-10-08"],
        ]),
      );
    });
  });

  it.each([
    ["movie", "200"],
    ["tv", "100"],
  ])("minRating %s: the default vote floor of %s", async (type, floor) => {
    const spy = mockDiscover();
    await run({ type, minRating: 8 });
    const params = discoverUrl(spy, type).searchParams;
    expect(params.get("sort_by")).toBe("popularity.desc");
    expect(params.get("vote_count.gte")).toBe(floor);
  });

  describe("mistakes the model can fix", () => {
    const rejects = async (args: object, message: string | RegExp) => {
      const spy = mockDiscover();
      const error = await run(args).catch((e) => e);
      expect(error).toBeInstanceOf(ToolError);
      expect(error.message).toMatch(message);
      return spy;
    };

    test("yearFrom after yearTo", async () => {
      const spy = await rejects(
        { type: "movie", yearFrom: 2019, yearTo: 2010 },
        "yearFrom (2019) is after yearTo (2010).",
      );
      expect(spy).not.toHaveBeenCalled();
    });

    // /discover/tv ignores with_cast and with_crew: unfiltered titles
    it.each([{ withCast: [287] }, { withCrew: [138] }])(
      "a person filter on TV: %j",
      async (person) => {
        const spy = await rejects(
          { type: "tv", ...person },
          "Cast and crew filters work for movies only. For TV, use get_person_credits.",
        );
        expect(spy).not.toHaveBeenCalled();
      },
    );

    it.each([
      ["tv", { genres: ["Horror"] }, '"Horror" isn\'t a TMDB TV genre.'],
      ["tv", { excludeGenres: ["Romance"] }, '"Romance" isn\'t a TMDB TV'],
      ["movie", { genres: ["Kids"] }, '"Kids" isn\'t a TMDB movie genre.'],
    ])("a genre %s doesn't have: %j", async (type, genres, message) => {
      const spy = await rejects({ type, ...genres }, message);
      // the cached genre list may load; nothing is discovered
      expect(tmdbUrls(spy, `/3/discover/${type}`)).toEqual([]);
    });

    test("the genre error lists the valid names for the type", async () => {
      await rejects(
        { type: "tv", genres: ["Horror"] },
        /Valid TV genres: Action, Adventure, Animation, Comedy, .*, Western$/,
      );
    });
  });

  // with_crew matches any job (writer, producer...), so it can't answer
  // "directed by"
  test('the description sends "directed by" to get_person_credits', () => {
    expect(discoverTitles.description).toContain(
      "withCrew matches any crew job",
    );
    expect(discoverTitles.description).toContain(
      'for "directed by" use get_person_credits with role "crew"',
    );
  });

  test("zod rejects a genre outside the enum", () => {
    expect(
      discoverTitles.args.safeParse({ type: "movie", genres: ["Cartoons"] })
        .success,
    ).toBe(false);
  });

  describe("a failed genre list", () => {
    const failGenres = () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      return mockTmdb({
        "/3/discover/movie": page([rawMovie(1)]),
        "/3/genre/movie/list": new Response("boom", { status: 503 }),
      });
    };

    test("no genre filter: still lists the titles, without genres", async () => {
      failGenres();
      const { results } = await run({ type: "movie" });
      expect(results).toEqual([expect.objectContaining({ id: 1, genres: [] })]);
    });

    it.each([{ genres: ["War"] }, { excludeGenres: ["War"] }])(
      "a genre filter %j: fails, nothing discovered",
      async (genres) => {
        const spy = failGenres();
        await expect(run({ type: "movie", ...genres })).rejects.toMatchObject({
          status: 503,
        });
        expect(tmdbUrls(spy, "/3/discover/movie")).toEqual([]);
      },
    );
  });

  test("passes the signal to every TMDB request", async () => {
    const spy = mockDiscover();
    const { signal } = new AbortController();

    await run({ type: "movie", genres: ["War"] }, signal);

    // the genre list and the discover request
    expect(spy).toHaveBeenCalledTimes(2);
    for (const [, init] of spy.mock.calls) {
      expect(init?.signal).toBe(signal);
    }
  });
});
