import { describe, expect, it, test, vi } from "vitest";
import { filteredMovies, type ListSortValues } from "./myList";
import { makeMovie } from "@test/helpers/factories";

// the module imports the DB, but filteredMovies never touches it
vi.mock("@/infra/db", () => ({ db: {} }));

const fixture = [
  makeMovie({
    movieId: 1,
    name: "Fury",
    type: "movie",
    status: "Completed",
    rating: 7,
  }),
  makeMovie({
    movieId: 2,
    name: "Heat",
    type: "movie",
    status: "Planning to watch",
    rating: 0,
  }),
  makeMovie({
    movieId: 3,
    name: "Alien",
    type: "movie",
    status: "Watching",
    rating: 10,
  }),
  makeMovie({
    movieId: 4,
    name: "Dark",
    type: "tv",
    status: "Watching",
    rating: 3,
  }),
  makeMovie({
    movieId: 5,
    name: "Lost",
    type: "tv",
    status: "Completed",
    rating: 0,
  }),
  makeMovie({
    movieId: 6,
    name: "Fargo",
    type: "tv",
    status: "Watching",
    rating: 7,
  }),
];

const defaults: ListSortValues = {
  type: "both",
  status: "all",
  rating: "desc",
};
const run = (o: Partial<ListSortValues> = {}) =>
  filteredMovies(fixture, { ...defaults, ...o });

describe("filteredMovies", () => {
  test("type: both keeps everything", () => {
    expect(run()).toHaveLength(6);
  });

  it.each([
    ["movie", 3],
    ["tv", 3],
  ] as const)("type: %s keeps only that type", (type, count) => {
    const result = run({ type });
    expect(result).toHaveLength(count);
    expect(result.every((m) => m.type === type)).toBe(true);
  });

  it.each([
    ["completed", "Completed", 2],
    ["planning", "Planning to watch", 1],
    ["watching", "Watching", 3],
  ] as const)("status: %s maps to %s", (status, label, count) => {
    const result = run({ status });
    expect(result).toHaveLength(count);
    expect(result.every((m) => m.status === label)).toBe(true);
  });

  test("status: all keeps everything", () => {
    expect(run({ status: "all" })).toHaveLength(6);
  });

  test("combines type and status filters", () => {
    const names = run({ type: "tv", status: "watching" }).map((m) => m.name);
    expect(names.sort()).toEqual(["Dark", "Fargo"]);
  });

  test("rating: asc sorts non-decreasing, unrated first", () => {
    const ratings = run({ rating: "asc" }).map((m) => m.rating);
    expect(ratings).toEqual([...ratings].sort((a, b) => a - b));
    expect(ratings[0]).toBe(0);
  });

  test("rating: desc sorts non-increasing, unrated last", () => {
    const ratings = run({ rating: "desc" }).map((m) => m.rating);
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
    expect(ratings.at(-1)).toBe(0);
  });

  const combos = (["both", "movie", "tv"] as const).flatMap((type) =>
    (["all", "completed", "planning", "watching"] as const).flatMap((status) =>
      (["asc", "desc"] as const).map((rating) => ({ type, status, rating })),
    ),
  );

  // the input is the cached getListMovies array: sorting it in place would leak
  it.each(combos)("does not mutate the input (%o)", (values) => {
    const original = structuredClone(fixture);
    const input = Object.freeze([...fixture]); // an in-place sort would throw
    filteredMovies(input as typeof fixture, values);
    expect(input).toEqual(original);
    expect(fixture).toEqual(original);
  });

  test("returns [] for an empty input", () => {
    expect(filteredMovies([], defaults)).toEqual([]);
  });
});
