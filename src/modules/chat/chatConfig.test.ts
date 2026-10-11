import { describe, expect, it, test, vi } from "vitest";
import { buildSystemInstruction } from "./chatConfig";
import { discoverTitles } from "./tools/discoverTitles";
import { CHAT_TOOLS, toolParameters } from "./tools/registry";
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

describe("tool rules", () => {
  const prompt = buildSystemInstruction();

  test("recommends only titles a tool returned", () => {
    expect(prompt).toContain(
      "Recommend only titles a tool returned in this conversation",
    );
  });

  test("asks for independent lookups as parallel calls in one round", () => {
    expect(prompt).toContain(
      "Make every lookup that doesn't depend on another one in the same round, as parallel calls",
    );
    expect(prompt).toContain(
      "Only lookups that need an id from a previous result go in the next round.",
    );
  });

  test("allows search links only when tool calls failed", () => {
    expect(prompt).toContain(
      "Only when tool calls failed (error results), you may recommend titles you know and link a search instead",
    );
    expect(prompt).toContain(
      "Never link a search for a title a tool searched for and didn't find: leave it out.",
    );
  });

  test("sets both years for this year's titles", () => {
    expect(buildSystemInstruction(new Date("2026-10-07T12:00:00Z"))).toContain(
      "yearFrom and yearTo (for this year, both 2026)",
    );
  });

  // discover's withCrew matches any crew job; /discover/tv has no cast filter
  test("sends TV people and directors to get_person_credits", () => {
    expect(prompt).toContain(
      '"Shows with <person>" or "directed by <person>": search_person, then get_person_credits.',
    );
  });
});

// catches tool renames and prompt edits that would point the model at tools
// or args that don't exist
describe("prompt and tools stay in sync", () => {
  const prompt = buildSystemInstruction();
  const toolNames = CHAT_TOOLS.map((tool) => tool.name);

  test("names every tool", () => {
    for (const name of toolNames) {
      expect(prompt).toContain(name);
    }
  });

  test("names only tools that exist", () => {
    const named = prompt.match(/\b(?:search|get|discover)_[a-z_]+\b/g) ?? [];
    expect(named.length).toBeGreaterThan(0);
    for (const name of named) {
      expect(toolNames).toContain(name);
    }
  });

  // the prompt names only discover_titles args
  const { properties: discoverArgs } = toolParameters(discoverTitles) as {
    properties: Record<string, { enum?: string[] }>;
  };

  // camelCase words in the prompt are arg names, unlike "sort" or "genres",
  // which are also plain words
  test("every camelCase arg it names exists", () => {
    const named = new Set(prompt.match(/\b[a-z]+[A-Z]\w*\b/g));
    // guards the pattern: it must find the args the prompt names today
    expect([...named]).toEqual(
      expect.arrayContaining([
        "yearFrom",
        "yearTo",
        "withCast",
        "minVotes",
        "minRating",
      ]),
    );
    for (const arg of named) {
      expect(discoverArgs).toHaveProperty(arg);
    }
  });

  test('every sort "<value>" it names is a discover_titles sort', () => {
    const sorts = [...prompt.matchAll(/\bsort "(\w+)"/g)].map((m) => m[1]);
    expect(sorts).toEqual(expect.arrayContaining(["popular", "top_rated"]));
    for (const sort of sorts) {
      expect(discoverArgs.sort.enum).toContain(sort);
    }
  });

  test("names genres as a discover_titles filter, which exists", () => {
    expect(prompt).toContain("discover_titles filters, e.g. genres");
    expect(discoverArgs).toHaveProperty("genres");
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
