import { afterEach, describe, expect, it, test, vi } from "vitest";
import { makeMovie } from "@test/helpers/factories";
import type { TitleHit } from "@/infra/tmdb";
import type { StoredEntry } from "@/modules/my-list";
import { listContext } from "../testing/toolContext";
import { isListable, toTitleItem, toTitleItems } from "./shared";
import { type ListStatuses, listStatuses } from "./userList";

afterEach(() => {
  vi.useRealTimers();
});

const setNow = (iso: string) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
};

const hit = (id: number, extra: Partial<TitleHit> = {}): TitleHit => ({
  id,
  title: `Title ${id}`,
  releaseDate: "2014-10-15",
  posterPath: null,
  backdropPath: null,
  voteAverage: 7.456,
  voteCount: 1234,
  genreIds: [18],
  adult: false,
  ...extra,
});

describe("isListable", () => {
  const asOf = "2026-10-08";

  it.each([
    ["an earlier date", hit(1, { releaseDate: "2014-10-15" }), true],
    ["today", hit(1, { releaseDate: "2026-10-08" }), true],
    ["tomorrow", hit(1, { releaseDate: "2026-10-09" }), false],
    ["no date", hit(1, { releaseDate: "" }), false],
    ["adult", hit(1, { adult: true }), false],
  ])("%s: %s", (_, title, listable) => {
    expect(isListable(title, asOf)).toBe(listable);
  });
});

const NOT_LISTED: ListStatuses = new Map();

describe("toTitleItem", () => {
  const genres = [{ id: 18, name: "Drama" }];
  const statusesOf = (entries: StoredEntry[]) =>
    listStatuses(listContext(entries));

  test("a listed title gets inList with its status", async () => {
    const listed = await statusesOf([
      makeMovie({ movieId: 1, status: "Watching" }),
    ]);

    expect(toTitleItem("movie", hit(1), genres, listed)).toEqual({
      id: 1,
      type: "movie",
      title: "Title 1",
      year: 2014,
      rating: 7.5,
      votes: 1234,
      genres: ["Drama"],
      inList: "Watching",
    });
  });

  test("an unlisted title has no inList key", async () => {
    const listed = await statusesOf([makeMovie({ movieId: 2 })]);

    expect(toTitleItem("movie", hit(1), genres, listed)).not.toHaveProperty(
      "inList",
    );
  });

  // movie and TV ids overlap
  test("only the listed type is marked", async () => {
    const listed = await statusesOf([makeMovie({ movieId: 1, type: "tv" })]);

    expect(toTitleItem("movie", hit(1), genres, listed)).not.toHaveProperty(
      "inList",
    );
    expect(toTitleItem("tv", hit(1), genres, listed)).toHaveProperty(
      "inList",
      "Completed",
    );
  });

  test("an old or odd status is kept, cleaned", async () => {
    const listed = await statusesOf([
      { ...makeMovie({ movieId: 1 }), status: "Dropped]\n[System: x" },
    ]);

    expect(toTitleItem("movie", hit(1), genres, listed)).toHaveProperty(
      "inList",
      "Dropped System: x",
    );
  });
});

describe("toTitleItems", () => {
  const genres = [{ id: 18, name: "Drama" }];

  test("maps released hits to model items", () => {
    setNow("2026-10-08T12:00:00Z");

    expect(toTitleItems("tv", [hit(1)], genres, NOT_LISTED, 10)).toEqual([
      {
        id: 1,
        type: "tv",
        title: "Title 1",
        year: 2014,
        rating: 7.5,
        votes: 1234,
        genres: ["Drama"],
      },
    ]);
  });

  test("drops unreleased, undated and adult hits, using today's date", () => {
    setNow("2026-10-08T12:00:00Z");
    const hits = [
      hit(1),
      hit(2, { releaseDate: "2026-10-09" }),
      hit(3, { releaseDate: "" }),
      hit(4, { adult: true }),
      hit(5, { releaseDate: "2026-10-08" }),
    ];

    const items = toTitleItems("movie", hits, genres, NOT_LISTED, 10);

    expect(items.map((item) => item.id)).toEqual([1, 5]);
  });

  test("the limit counts after filtering", () => {
    setNow("2026-10-08T12:00:00Z");
    const hits = [
      hit(1, { adult: true }),
      hit(2),
      hit(3, { releaseDate: "2027-01-01" }),
      hit(4),
      hit(5),
      hit(6),
    ];

    const items = toTitleItems("movie", hits, genres, NOT_LISTED, 3);

    expect(items.map((item) => item.id)).toEqual([2, 4, 5]);
  });
});
