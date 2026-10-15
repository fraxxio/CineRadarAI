import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TmdbError } from "@/infra/tmdb/server";
import { hangUntilAborted, mockTmdb, tmdbUrls } from "@test/helpers/tmdb";
import { rawDetails } from "../testing/tmdbData";
import { toolContext } from "../testing/toolContext";
import { showRecommendations } from "./showRecommendations";
import { DisplayOutput } from "./types";

type Item = { type: "movie" | "tv"; id: number; title: string; reason: string };

// the title defaults to rawDetails' title of that type
const item = (id: number, extra: Partial<Item> = {}): Item => ({
  type: "movie",
  id,
  title: `${extra.type === "tv" ? "Show" : "Movie"} ${id}`,
  reason: `Reason ${id}.`,
  ...extra,
});

// args as the registry passes them: parsed
const run = async (items: Item[], signal = new AbortController().signal) => {
  const value = await showRecommendations.run(
    showRecommendations.args.parse({ items }),
    toolContext({ signal }),
  );
  expect(value).toBeInstanceOf(DisplayOutput);
  const { output, events } = value as DisplayOutput;
  // one cards event, none when no title is shown
  const cards = events.flatMap((event) =>
    event.type === "cards" ? event.items : [],
  );
  expect(events).toHaveLength(cards.length ? 1 : 0);
  return { output, cards };
};

const down = () => new Response("down", { status: 503 });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("show_recommendations", () => {
  test("cards in arg order, with TMDB's data and the arg's reason", async () => {
    mockTmdb({
      "/3/movie/228150": rawDetails(228150, {
        title: "Fury",
        poster_path: "/fury.jpg",
        backdrop_path: "/fury-b.jpg",
      }),
      "/3/tv/1399": rawDetails(1399, {
        name: "Game of Thrones",
        first_air_date: "2011-04-17",
        vote_average: 8.456,
        backdrop_path: null,
        genres: [{ id: 10765, name: "Sci-Fi & Fantasy" }],
      }),
    });

    const { cards, output } = await run([
      item(1399, {
        type: "tv",
        title: "Game of Thrones",
        reason: "Epic fantasy.",
      }),
      item(228150, { title: "Fury", reason: "Tank-crew drama." }),
    ]);

    expect(cards).toEqual([
      {
        type: "tv",
        id: 1399,
        title: "Game of Thrones",
        year: 2011,
        rating: 8.5,
        genres: ["Sci-Fi & Fantasy"],
        posterPath: "/p.jpg",
        backdropPath: null,
        reason: "Epic fantasy.",
      },
      {
        type: "movie",
        id: 228150,
        title: "Fury",
        year: 2014,
        rating: 7.5,
        genres: ["War", "Drama"],
        posterPath: "/fury.jpg",
        backdropPath: "/fury-b.jpg",
        reason: "Tank-crew drama.",
      },
    ]);
    expect(output).toEqual({
      shown: [
        {
          position: 1,
          id: 1399,
          type: "tv",
          title: "Game of Thrones",
          year: 2011,
        },
        { position: 2, id: 228150, type: "movie", title: "Fury", year: 2014 },
      ],
      notShown: [],
    });
  });

  test("the model output has no poster or backdrop paths", async () => {
    mockTmdb({ "/3/movie/1": rawDetails(1) });

    const { output } = await run([item(1)]);

    expect(JSON.stringify(output)).not.toMatch(/poster|backdrop|\.jpg/i);
  });

  test("a 404 goes to notShown and makes no card", async () => {
    mockTmdb({ "/3/movie/1": rawDetails(1) });

    const { cards, output } = await run([item(1), item(2)]);

    expect(cards.map((card) => card.id)).toEqual([1]);
    expect(output).toMatchObject({
      shown: [{ position: 1, id: 1 }],
      notShown: [{ id: 2, type: "movie", reason: "not found on TMDB" }],
    });
  });

  test("an unreleased or undated title goes to notShown", async () => {
    mockTmdb({
      "/3/movie/1": rawDetails(1, { release_date: "2026-06-01" }),
      "/3/movie/2": rawDetails(2, { release_date: "2026-06-02" }),
      "/3/movie/3": rawDetails(3, { release_date: "" }),
    });

    const { cards, output } = await run([item(1), item(2), item(3)]);

    // released today counts
    expect(cards.map((card) => card.id)).toEqual([1]);
    expect(output).toMatchObject({
      notShown: [
        { id: 2, type: "movie", reason: "not released yet" },
        { id: 3, type: "movie", reason: "not released yet" },
      ],
    });
  });

  test("an adult title goes to notShown without its name", async () => {
    mockTmdb({
      "/3/movie/1": rawDetails(1, { adult: false }),
      "/3/movie/2": rawDetails(2, { adult: true }),
    });

    const { cards, output } = await run([item(1), item(2)]);

    expect(cards.map((card) => card.id)).toEqual([1]);
    expect(output).toEqual({
      shown: [expect.objectContaining({ id: 1 })],
      notShown: [{ id: 2, type: "movie", reason: "not available" }],
    });
  });

  test("an id of another title goes to notShown, naming both titles", async () => {
    mockTmdb({
      "/3/movie/550": rawDetails(550, { title: "Fight Club" }),
      "/3/movie/551": rawDetails(551, { title: "The Poseidon Adventure" }),
    });

    const { cards, output } = await run([
      item(550, { title: "Fight Club" }),
      item(551, { title: "Fight Club" }),
    ]);

    expect(cards.map((card) => card.id)).toEqual([550]);
    expect(output).toMatchObject({
      notShown: [
        {
          id: 551,
          type: "movie",
          reason: 'the id is "The Poseidon Adventure", not "Fight Club"',
        },
      ],
    });
  });

  test("the title matches ignoring case, accents, spaces and punctuation, or by its original title", async () => {
    mockTmdb({
      "/3/movie/1": rawDetails(1, { title: "Ford v Ferrari" }),
      "/3/movie/2": rawDetails(2, { title: "Amélie" }),
      "/3/movie/3": rawDetails(3, {
        title: "Spirited Away",
        original_title: "千と千尋の神隠し",
      }),
      "/3/tv/4": rawDetails(4, {
        name: "Money Heist",
        original_name: "La casa de papel",
      }),
    });

    const { cards, output } = await run([
      item(1, { title: "ford v. ferrari" }),
      item(2, { title: "Amelie" }),
      item(3, { title: "千と千尋の神隠し" }),
      item(4, { type: "tv", title: "La Casa de Papel" }),
    ]);

    expect(cards.map((card) => [card.id, card.title])).toEqual([
      [1, "Ford v Ferrari"],
      [2, "Amélie"],
      [3, "Spirited Away"],
      [4, "Money Heist"],
    ]);
    expect(output).toMatchObject({ notShown: [] });
  });

  test("a repeated type and id is looked up once and reported as listed twice", async () => {
    const spy = mockTmdb({
      "/3/movie/1": rawDetails(1),
      "/3/tv/1": rawDetails(1),
    });

    const { cards, output } = await run([
      item(1, { reason: "First." }),
      item(1, { type: "tv" }),
      item(1, { reason: "Again." }),
    ]);

    // movie and TV ids can collide: both are cards
    expect(cards.map((card) => [card.type, card.reason])).toEqual([
      ["movie", "First."],
      ["tv", "Reason 1."],
    ]);
    expect(output).toMatchObject({
      notShown: [{ id: 1, type: "movie", reason: "listed twice" }],
    });
    expect(tmdbUrls(spy, "/3/movie/1")).toHaveLength(1);
  });

  test("a title nobody voted for has no rating", async () => {
    mockTmdb({
      "/3/movie/1": rawDetails(1, { vote_average: 0, vote_count: 0 }),
    });

    const { cards } = await run([item(1)]);

    expect(cards[0].rating).toBeNull();
  });

  test("a failed lookup next to a good one goes to notShown", async () => {
    mockTmdb({ "/3/movie/1": rawDetails(1), "/3/movie/2": down() });

    const { cards, output } = await run([item(1), item(2)]);

    expect(cards.map((card) => card.id)).toEqual([1]);
    expect(output).toMatchObject({
      notShown: [{ id: 2, type: "movie", reason: "couldn't be checked" }],
    });
  });

  test("every lookup failing with a server error throws the first error", async () => {
    mockTmdb({ "/3/movie/1": down(), "/3/movie/2": down() });

    await expect(run([item(1), item(2)])).rejects.toSatisfy(
      (error) => error instanceof TmdbError && error.status === 503,
    );
  });

  test("404s and server errors without a card: no cards, the model can search again", async () => {
    mockTmdb({ "/3/movie/2": down() });

    const { cards, output } = await run([item(1), item(2)]);

    expect(cards).toEqual([]);
    expect(output).toEqual({
      shown: [],
      notShown: [
        { id: 1, type: "movie", reason: "not found on TMDB" },
        { id: 2, type: "movie", reason: "couldn't be checked" },
      ],
    });
  });

  test("passes the signal to fetch", async () => {
    const spy = mockTmdb({ "/3/movie/1": rawDetails(1) });
    const { signal } = new AbortController();

    await run([item(1)], signal);

    expect(spy.mock.lastCall?.[1]?.signal).toBe(signal);
  });

  test("an abort rethrows the abort reason", async () => {
    const spy = mockTmdb({
      "/3/movie/1": rawDetails(1),
      "/3/movie/2": hangUntilAborted,
    });
    const controller = new AbortController();

    const running = showRecommendations.run(
      { items: [item(1), item(2)] },
      toolContext({ signal: controller.signal }),
    );
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    controller.abort();

    await expect(running).rejects.toBe(controller.signal.reason);
  });

  test("args: 1 to 10 items, each with a positive integer id, a title and a short reason", () => {
    const parse = (items: unknown) =>
      showRecommendations.args.safeParse({ items }).success;
    const items = (n: number) =>
      Array.from({ length: n }, (_, i) => item(i + 1));

    expect(parse(items(1))).toBe(true);
    expect(parse(items(10))).toBe(true);
    expect(parse(items(0))).toBe(false);
    expect(parse(items(11))).toBe(false);
    expect(parse([item(0)])).toBe(false);
    expect(parse([item(1.5)])).toBe(false);
    expect(parse([item(1, { title: "" })])).toBe(false);
    expect(parse([{ type: "movie", id: 1, reason: "Fits." }])).toBe(false);
    expect(parse([item(1, { title: "a".repeat(300) })])).toBe(true);
    expect(parse([item(1, { title: "a".repeat(301) })])).toBe(false);
    expect(parse([item(1, { reason: "" })])).toBe(false);
    expect(parse([item(1, { reason: "a".repeat(200) })])).toBe(true);
    expect(parse([item(1, { reason: "a".repeat(201) })])).toBe(false);
  });
});
