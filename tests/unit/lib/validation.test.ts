import { describe, expect, it, test } from "vitest";
import { movieFilterSchema } from "@/lib/validation";

describe("movieFilterSchema", () => {
  test("accepts an empty object", () => {
    expect(movieFilterSchema.safeParse({}).success).toBe(true);
  });

  test("accepts every valid field", () => {
    const input = {
      query: "Fury",
      language: "fr",
      year: "2014",
      adult: true,
      btn: "tv",
      page: "2",
    };
    expect(movieFilterSchema.parse(input)).toEqual(input);
  });

  test("rejects an invalid btn", () => {
    const result = movieFilterSchema.safeParse({ btn: "x" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["btn"]);
  });

  it.each([
    ["on", true],
    ["", false],
    [1, true],
    [0, false],
  ])("coerces adult %j to %s", (adult, expected) => {
    expect(movieFilterSchema.parse({ adult }).adult).toBe(expected);
  });
});
