import { describe, expect, test } from "vitest";
import { matchesTitle, titleKey } from "./titleKey";

describe("titleKey", () => {
  test("ignores case, accents, spaces and punctuation", () => {
    expect(titleKey("Ford v. Ferrari")).toBe(titleKey("ford V ferrari"));
    expect(titleKey("Amélie")).toBe(titleKey("Amelie"));
  });

  test("keeps letters and digits of any script", () => {
    expect(titleKey("千と千尋の神隠し")).toBe("千と千尋の神隠し");
    expect(titleKey("Dune: Part Two")).not.toBe(titleKey("Dune"));
  });
});

describe("matchesTitle", () => {
  const title = { title: "Spirited Away", originalTitle: "千と千尋の神隠し" };

  test("matches the title or the original title", () => {
    expect(matchesTitle("spirited away", title)).toBe(true);
    expect(matchesTitle("千と千尋の神隠し", title)).toBe(true);
    expect(matchesTitle("Princess Mononoke", title)).toBe(false);
  });

  test("an empty original title doesn't match a name without letters", () => {
    expect(matchesTitle("...", { title: "Fury", originalTitle: "" })).toBe(
      false,
    );
  });
});
