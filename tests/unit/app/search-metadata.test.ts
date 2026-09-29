import { describe, expect, test } from "vitest";
import { generateMetadata } from "@/app/search/page";

const title = (searchParams: Record<string, string>) =>
  generateMetadata({ searchParams } as any).title;

describe("search page generateMetadata", () => {
  test("no query -> Manual search", () => {
    expect(title({})).toBe("Manual search | CineRadar");
  });

  test("query only (language defaults to en)", () => {
    expect(title({ query: "Fury" })).toBe(
      "Results for: Fury in EN language | CineRadar",
    );
  });

  test("language, year and adult", () => {
    expect(
      title({ query: "Fury", language: "fr", year: "2014", adult: "true" }),
    ).toBe(
      "Results for: Fury in FR language, 2014 year, including adult. | CineRadar",
    );
  });

  test('adult: "false" -> no "including adult"', () => {
    expect(title({ query: "Fury", adult: "false" })).not.toContain(
      "including adult",
    );
  });
});
