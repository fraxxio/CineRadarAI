import { describe, expect, test } from "vitest";
import { lastTmdbUrl, mockTmdb, tmdbFixture } from "@test/helpers/tmdb";
import { getTitleDetails } from "./getTitleDetails";

const ctx = () => ({ signal: new AbortController().signal });

// handlers return plain JSON for the model
const details = async (type: "movie" | "tv", id: number) =>
  (await getTitleDetails.run({ type, id }, ctx())) as Record<string, unknown>;

const cast = (...names: string[]) => ({
  // shuffled order on the wire: the billing order must come from `order`
  cast: names.map((name, order) => ({ name, order })).reverse(),
});

const movie = (extra: object = {}) => ({
  ...tmdbFixture<object>("movie-550"),
  vote_average: 8.438,
  vote_count: 30000,
  overview: "Short overview.",
  credits: cast(
    "Edward Norton",
    "Brad Pitt",
    "Helena Bonham Carter",
    "Meat Loaf",
    "Jared Leto",
    "Zach Grenier",
  ),
  ...extra,
});

describe("get_title_details", () => {
  test("movie: only the listed fields, top 5 cast in billing order", async () => {
    const spy = mockTmdb({ "/3/movie/550": movie() });

    const details = await getTitleDetails.run(
      { type: "movie", id: 550 },
      ctx(),
    );

    expect(spy).toHaveBeenCalledOnce();
    expect(lastTmdbUrl(spy).searchParams.get("append_to_response")).toBe(
      "credits",
    );
    expect(details).toEqual({
      id: 550,
      type: "movie",
      title: "Fight Club",
      year: 1999,
      genres: tmdbFixture("movie-550").genres.map(
        (genre: { name: string }) => genre.name,
      ),
      runtime: 139,
      rating: 8.4,
      votes: 30000,
      overview: "Short overview.",
      cast: [
        "Edward Norton",
        "Brad Pitt",
        "Helena Bonham Carter",
        "Meat Loaf",
        "Jared Leto",
      ],
    });
  });

  test("TV: seasons and episode runtime instead of runtime", async () => {
    mockTmdb({
      "/3/tv/1399": {
        ...tmdbFixture<object>("tv-1399"),
        episode_run_time: [60],
        credits: cast("Emilia Clarke"),
      },
    });

    const details = await getTitleDetails.run({ type: "tv", id: 1399 }, ctx());

    expect(details).toMatchObject({
      type: "tv",
      title: "Game of Thrones",
      year: 2011,
      seasons: 8,
      episodeRuntime: 60,
      cast: ["Emilia Clarke"],
    });
    expect(details).not.toHaveProperty("runtime");
  });

  test("unknown runtimes are null", async () => {
    mockTmdb({
      "/3/movie/550": movie({ runtime: 0 }),
      "/3/tv/1399": { ...tmdbFixture<object>("tv-1399"), episode_run_time: [] },
    });

    const film = await getTitleDetails.run({ type: "movie", id: 550 }, ctx());
    const show = await getTitleDetails.run({ type: "tv", id: 1399 }, ctx());

    expect(film).toMatchObject({ runtime: null });
    expect(film).not.toHaveProperty("seasons");
    expect(show).toMatchObject({ episodeRuntime: null });
  });

  test("the overview is cut to 300 characters", async () => {
    mockTmdb({
      "/3/movie/550": movie({ overview: "word ".repeat(100) }),
    });

    const { overview } = (await details("movie", 550)) as { overview: string };

    expect(overview).toHaveLength(300);
    expect(overview.endsWith("…")).toBe(true);
  });

  test("an overview of exactly 300 characters is kept", async () => {
    const text = "a".repeat(300);
    mockTmdb({ "/3/movie/550": movie({ overview: text }) });

    const { overview } = (await details("movie", 550)) as { overview: string };

    expect(overview).toBe(text);
  });

  test("passes the signal to fetch", async () => {
    const spy = mockTmdb({ "/3/movie/550": movie() });
    const { signal } = new AbortController();

    await getTitleDetails.run({ type: "movie", id: 550 }, { signal });

    expect(spy.mock.lastCall?.[1]?.signal).toBe(signal);
  });

  test("args: a positive integer id", () => {
    const parse = (id: unknown) =>
      getTitleDetails.args.safeParse({ type: "movie", id }).success;
    expect(parse(550)).toBe(true);
    expect(parse(0)).toBe(false);
    expect(parse(-1)).toBe(false);
    expect(parse(1.5)).toBe(false);
    expect(parse("550")).toBe(false);
  });
});
