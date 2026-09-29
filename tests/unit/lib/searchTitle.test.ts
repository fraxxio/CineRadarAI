import { describe, expect, it } from "vitest";
import { getTitle } from "@/lib/searchTitle";

describe("getTitle", () => {
  it.each([
    [{}, "Trending movies"],
    [{ query: "" }, "Trending movies"],
    [{ query: "Fury" }, "Results for: Fury"],
    [{ query: "Fury", language: "fr" }, "Results for: Fury in FR language"],
    [{ query: "Fury", year: "2014" }, "Results for: Fury, 2014 year"],
    [{ query: "Fury", adult: true }, "Results for: Fury, including adult."],
    [{ query: "Fury", adult: false }, "Results for: Fury"],
    [
      { query: "Fury", language: "fr", year: "2014", adult: true },
      "Results for: Fury in FR language, 2014 year, including adult.",
    ],
  ])("%o -> %s", (values, expected) => {
    expect(getTitle(values)).toBe(expected);
  });

  it.each([
    [{ btn: "movie" as const }, "Trending movies"],
    [{ btn: "tv" as const }, "Trending TV shows"],
    [{ btn: "tv" as const, query: "Fury" }, "Results for: Fury"],
  ])("[B7] %o -> %s", (values, expected) => {
    expect(getTitle(values)).toBe(expected);
  });
});
