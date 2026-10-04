import { describe, expect, it, test } from "vitest";
import { formatCurrency } from "./formatCurrency";

describe("formatCurrency", () => {
  it.each([
    [0, "$0"],
    [999, "$999"],
    [1000, "$1.0k"],
    [1_500_000, "$1.5M"],
    [2_300_000_000, "$2.3B"],
    [1e6, "$1.0M"],
    [1e9, "$1.0B"],
  ])("%d -> %s", (amount, expected) => {
    expect(formatCurrency(amount)).toBe(expected);
  });

  // pins current rounding: 999.999k rounds up inside the "k" branch.
  // If the rounding gets fixed, change this to "$1.0M".
  test("999_999 -> $1000.0k", () => {
    expect(formatCurrency(999_999)).toBe("$1000.0k");
  });
});
