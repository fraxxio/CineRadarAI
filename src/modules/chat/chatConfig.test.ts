import { describe, expect, it, test, vi } from "vitest";
import { buildSystemInstruction } from "./chatConfig";
import { movieFilterSchema } from "@/modules/search";

describe("buildSystemInstruction", () => {
  test("includes the given date as YYYY-MM-DD (UTC)", () => {
    expect(buildSystemInstruction(new Date("2026-03-04T12:00:00Z"))).toContain(
      "Today's date is 2026-03-04.",
    );
  });

  test('defines "this year" as the year of the given date', () => {
    expect(buildSystemInstruction(new Date("2026-10-07T12:00:00Z"))).toContain(
      '"This year" means 2026',
    );
  });

  test("contains the link formats the app relies on", () => {
    const prompt = buildSystemInstruction();
    expect(prompt).toContain("[Title](/search/movie/{id}) (YYYY)");
    expect(prompt).toContain("[Title](/search/tv/{id}) (TV, YYYY)");
    expect(prompt).toContain("(/search?query=Title&btn=movie&year=YYYY)");
    expect(prompt).toContain("(/search?query=Title&btn=tv)");
  });

  // catches prompt edits that would link to pages that don't exist
  test("every exact title link points to a title page", () => {
    const links = [
      ...buildSystemInstruction().matchAll(/\]\((\/search\/[^)\s]+)\)/g),
    ].map((m) => m[1]);

    for (const link of links) {
      expect(link).toMatch(/^\/search\/(movie|tv)\/(\d+|\{id\})$/);
    }
    // the example uses real TMDB ids: Fury and Inglourious Basterds
    expect(links.filter((link) => /\d+$/.test(link))).toEqual([
      "/search/movie/228150",
      "/search/movie/16869",
    ]);
  });

  // catches prompt edits that would produce links the search page can't parse
  test("every fallback link matches the search page's contract", () => {
    const links = [
      ...buildSystemInstruction().matchAll(/\((\/search\?[^)\s]+)\)/g),
    ].map((m) => m[1]);
    expect(links).toHaveLength(2);

    for (const link of links) {
      const params = Object.fromEntries(new URL(link, "http://x").searchParams);
      const parsed = movieFilterSchema.parse(params);
      expect(parsed.query).toBeTruthy();
      expect(["movie", "tv"]).toContain(parsed.btn);
    }
  });
});

describe("CHAT_MODEL", () => {
  // read at import time, so re-import after stubbing
  test("falls back to the default when GEMINI_MODEL is unset", async () => {
    vi.resetModules();
    vi.stubEnv("GEMINI_MODEL", "");
    const { CHAT_MODEL } = await import("./chatConfig");
    expect(CHAT_MODEL).toBe("gemini-3.5-flash-lite");
  });

  test("uses GEMINI_MODEL when set", async () => {
    vi.resetModules();
    vi.stubEnv("GEMINI_MODEL", "custom-model");
    const { CHAT_MODEL } = await import("./chatConfig");
    expect(CHAT_MODEL).toBe("custom-model");
  });
});

describe("CHAT_THINKING_LEVEL", () => {
  // read at import time, so re-import after stubbing
  const load = async (value: string) => {
    vi.resetModules();
    vi.stubEnv("GEMINI_THINKING_LEVEL", value);
    return (await import("./chatConfig")).CHAT_THINKING_LEVEL;
  };

  test("falls back to minimal when unset", async () => {
    expect(await load("")).toBe("minimal");
  });

  it.each(["minimal", "low", "medium", "high"])(
    "uses %j when set",
    async (level) => {
      expect(await load(level)).toBe(level);
    },
  );

  it.each(["max", "LOW", " low"])(
    "an invalid %j falls back to minimal with a warning",
    async (level) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      expect(await load(level)).toBe("minimal");
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(`Invalid GEMINI_THINKING_LEVEL "${level}"`),
      );
    },
  );
});
