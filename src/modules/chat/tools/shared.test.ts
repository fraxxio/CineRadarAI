import { afterEach, describe, expect, it, test, vi } from "vitest";
import type { TitleHit } from "@/infra/tmdb";
import { isReleased, toTitleItems, today } from "./shared";

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

describe("today", () => {
  it.each([
    ["2026-10-08T00:00:00Z", "2026-10-08"],
    ["2026-10-08T23:59:59.999Z", "2026-10-08"],
    // just after midnight in UTC+3 is still the day before in UTC
    ["2026-10-09T01:30:00+03:00", "2026-10-08"],
  ])("%s -> %s", (now, date) => {
    setNow(now);
    expect(today()).toBe(date);
  });
});

describe("isReleased", () => {
  const asOf = "2026-10-08";

  it.each([
    ["an earlier date", hit(1, { releaseDate: "2014-10-15" }), true],
    ["today", hit(1, { releaseDate: "2026-10-08" }), true],
    ["tomorrow", hit(1, { releaseDate: "2026-10-09" }), false],
    ["no date", hit(1, { releaseDate: "" }), false],
    ["adult", hit(1, { adult: true }), false],
  ])("%s: %s", (_, title, released) => {
    expect(isReleased(title, asOf)).toBe(released);
  });
});

describe("toTitleItems", () => {
  const genres = [{ id: 18, name: "Drama" }];

  test("maps released hits to model items", () => {
    setNow("2026-10-08T12:00:00Z");

    expect(toTitleItems("tv", [hit(1)], genres, 10)).toEqual([
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

    const items = toTitleItems("movie", hits, genres, 10);

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

    const items = toTitleItems("movie", hits, genres, 3);

    expect(items.map((item) => item.id)).toEqual([2, 4, 5]);
  });
});
