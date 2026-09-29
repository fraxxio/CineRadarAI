import { describe, expect, it, test } from "vitest";
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

  test.fails("[B7] no query while browsing TV mentions TV", () => {
    expect(getTitle({ btn: "tv" })).toMatch(/tv/i);
  });
});
