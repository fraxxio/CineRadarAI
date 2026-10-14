import { describe, expect, it, test, vi } from "vitest";
import { buildSystemInstruction } from "./chatConfig";
import { discoverTitles } from "./tools/discoverTitles";
import { CHAT_TOOLS, toolParameters } from "./tools/registry";

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

  // the cards replaced the markdown links
  test("asks for no links", () => {
    const prompt = buildSystemInstruction();
    expect(prompt).not.toContain("](/search");
    expect(prompt).not.toContain("/search?query=");
  });

  test("the example passes the real TMDB ids of Fury and Inglourious Basterds", () => {
    const example = buildSystemInstruction().split("# Example")[1];
    const titles = [...example.matchAll(/([A-Z][\w ]*) \(movie (\d+)\)/g)].map(
      (m) => [m[1], Number(m[2])],
    );
    expect(titles).toEqual([
      ["Fury", 228150],
      ["Inglourious Basterds", 16869],
    ]);
  });

  // a call written as code in the example gets copied into the answer text
  test("the example describes the call instead of writing it as code", () => {
    const example = buildSystemInstruction().split("# Example")[1];
    expect(example).not.toMatch(/show_recommendations\(|"items"/);
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

  test("shows recommendations only as cards", () => {
    expect(prompt).toContain("show_recommendations");
    expect(prompt).toContain(
      "Never write recommendations in text, as a list or in sentences.",
    );
  });

  test("saves to the list only when asked", () => {
    expect(prompt).toContain(
      "Call save_to_list only when the user asks to save a title to their list or change its status. Never on your own initiative.",
    );
  });

  test("recommends nothing from memory when the tools fail", () => {
    expect(prompt).toContain("Don't recommend titles from memory.");
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

describe("list rules", () => {
  const prompt = buildSystemInstruction();

  test("says whether the user is signed in, signed out by default", () => {
    expect(prompt).toContain("The user is signed out.");
    expect(prompt).not.toContain("The user is signed in.");
    const signedIn = buildSystemInstruction(new Date(), {
      userStatus: "signed_in",
    });
    expect(signedIn).toContain("The user is signed in.");
    expect(signedIn).not.toContain("The user is signed out.");
  });

  test("an unreadable session: says neither, the rules stay", () => {
    const unavailable = buildSystemInstruction(new Date(), {
      userStatus: "unavailable",
    });
    expect(unavailable).not.toMatch(/The user is signed (in|out)\./);
    expect(unavailable).toContain(
      "this year's.\n- Don't claim a title is available",
    );
  });

  test("maps the user's words to the list statuses", () => {
    expect(prompt).toContain(
      '"watchlist", "want to watch" or "save for later" is "Planning to watch"',
    );
    expect(prompt).toContain('"watching" or "started" is "Watching"');
    expect(prompt).toContain(
      '"watched", "seen" or "finished" is "Completed". If the user names no status, leave it out.',
    );
  });

  test("asks which title when several match, only for saves", () => {
    expect(prompt).toContain(
      "and the conversation doesn't say which, ask which one instead of saving",
    );
    expect(prompt).toContain(
      "If a request for recommendations is vague, don't ask clarifying questions first",
    );
  });

  test("one call per title, in parallel", () => {
    expect(prompt).toContain(
      "One call per title. For several titles, make the calls in parallel in the same round.",
    );
  });

  test("calls the tool when signed out, and claims only real saves", () => {
    expect(prompt).toContain("If the user is signed out, still call it");
    expect(prompt).toContain(
      "Never say a title was saved unless save_to_list returned it as saved.",
    );
    expect(prompt).toContain(
      "After save_to_list returns, always write one short line",
    );
  });

  // live, "is Fury in my list?" after an Undo saved it again
  test("a question about the list isn't a save", () => {
    expect(prompt).toContain(
      'A question about the list (e.g. "is it in my list?") isn\'t a request to save',
    );
    expect(prompt).toContain(
      "They aren't requests: never save because of them.",
    );
  });

  test("list questions are answered with get_my_list", () => {
    expect(prompt).toContain(
      "isn't a request to save: answer it with get_my_list.",
    );
    expect(prompt).not.toContain("You can't read the list itself");
  });

  test("explains the list-change note", () => {
    expect(prompt).toContain(
      'Lines in brackets that start with "[List update:" are added by the app',
    );
  });

  test("counts the list as a related topic", () => {
    expect(prompt).toContain("unrelated to movies, TV shows or their list");
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
