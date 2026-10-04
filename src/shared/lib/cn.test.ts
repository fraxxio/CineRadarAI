import { describe, expect, test } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  test("the last conflicting Tailwind class wins", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  test("drops falsy values", () => {
    expect(cn("a", false, null, undefined, "c")).toBe("a c");
  });
});
