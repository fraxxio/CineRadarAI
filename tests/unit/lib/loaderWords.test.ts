import { describe, expect, test, vi } from "vitest";
import { LOADER_WORDS, shuffle } from "@/lib/loaderWords";

describe("shuffle", () => {
  test("returns a new array with the same elements", () => {
    const input = [...LOADER_WORDS];
    const out = shuffle(input);
    expect(out).not.toBe(input);
    expect(out).toHaveLength(input.length);
    expect([...out].sort()).toEqual([...input].sort());
  });

  test("does not mutate the input", () => {
    const input = Object.freeze([1, 2, 3, 4, 5]);
    shuffle(input as number[]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  test("is deterministic when Math.random is stubbed", () => {
    // Fisher–Yates with j = 0 on every step
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(shuffle([1, 2, 3, 4])).toEqual([2, 3, 4, 1]);
  });

  test("handles empty and single-item arrays", () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle(["a"])).toEqual(["a"]);
  });
});
