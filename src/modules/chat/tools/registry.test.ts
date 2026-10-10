import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";
import { z } from "zod/v4";
import { deferred } from "@test/helpers/deferred";
import { hangUntilAborted, mockTmdb, tmdbUrls } from "@test/helpers/tmdb";
import { MOVIE_GENRES, TV_GENRES, page, rawMovie } from "../testing/tmdbData";
import {
  CHAT_TOOLS,
  MAX_CALLS_PER_ROUND,
  runToolCalls,
  statusFor,
  toolParameters,
} from "./registry";
import { defineTool, type ToolCall } from "./types";

// Gemini's JSON Schema subset:
// https://ai.google.dev/gemini-api/docs/structured-output#json-schema-support
// one rejected keyword fails every chat request, so add a keyword here only
// after `npm run check:chat-tools` has shown Gemini accepts it
const ALLOWED_SCHEMA_KEYWORDS = new Set([
  "type",
  "properties",
  "required",
  "description",
  "enum",
  "items",
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "default",
  "additionalProperties",
]);
const SCHEMA_TYPES = new Set([
  "string",
  "number",
  "integer",
  "boolean",
  "object",
  "array",
]);

const isSchema = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// paths of keywords and types outside the subset, e.g.
// "properties.originalLanguage.pattern"; descends only into sub-schemas, so
// property names and enum, required or default values aren't keywords
function schemaProblems(
  schema: Record<string, unknown>,
  path: string[] = [],
): string[] {
  const at = (...keys: string[]) => [...path, ...keys].join(".");
  const problems: string[] = [];
  for (const [key, value] of Object.entries(schema)) {
    if (!ALLOWED_SCHEMA_KEYWORDS.has(key)) {
      problems.push(at(key));
    } else if (
      key === "type" &&
      !(typeof value === "string" && SCHEMA_TYPES.has(value))
    ) {
      problems.push(`${at(key)} = ${JSON.stringify(value)}`);
    }
  }
  if (isSchema(schema.properties)) {
    for (const [name, sub] of Object.entries(schema.properties)) {
      if (isSchema(sub)) {
        problems.push(...schemaProblems(sub, [...path, "properties", name]));
      }
    }
  }
  if (isSchema(schema.items)) {
    problems.push(...schemaProblems(schema.items, [...path, "items"]));
  }
  if (isSchema(schema.additionalProperties)) {
    problems.push(
      ...schemaProblems(schema.additionalProperties, [
        ...path,
        "additionalProperties",
      ]),
    );
  }
  return problems;
}

const toolWithArgs = (args: z.ZodType) =>
  defineTool({
    name: "test_tool",
    description: "",
    status: "",
    args,
    run: async () => ({}),
  });

const GENRES = {
  "/3/genre/movie/list": MOVIE_GENRES,
  "/3/genre/tv/list": TV_GENRES,
};

const search = (id: string, args: object | string): ToolCall => ({
  id,
  name: "search_titles",
  rawArgs: typeof args === "string" ? args : JSON.stringify(args),
});

const live = () => new AbortController().signal;

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
});

describe("CHAT_TOOLS", () => {
  test("the three TMDB tools", () => {
    expect(CHAT_TOOLS.map((tool) => tool.name)).toEqual([
      "search_titles",
      "discover_titles",
      "get_title_details",
    ]);
  });

  // what the model sees: review any change here against the Gemini docs
  test("generated parameter schemas", () => {
    expect(
      Object.fromEntries(
        CHAT_TOOLS.map((tool) => [tool.name, toolParameters(tool)]),
      ),
    ).toMatchInlineSnapshot(`
      {
        "discover_titles": {
          "properties": {
            "excludeGenres": {
              "description": "Titles must have none of these genres",
              "items": {
                "enum": [
                  "Action",
                  "Adventure",
                  "Animation",
                  "Comedy",
                  "Crime",
                  "Documentary",
                  "Drama",
                  "Family",
                  "Fantasy",
                  "History",
                  "Horror",
                  "Kids",
                  "Music",
                  "Mystery",
                  "Reality",
                  "Romance",
                  "Science Fiction",
                  "Thriller",
                  "War",
                  "Western",
                ],
                "type": "string",
              },
              "maxItems": 5,
              "minItems": 1,
              "type": "array",
            },
            "genres": {
              "description": "Titles must have all of these genres",
              "items": {
                "enum": [
                  "Action",
                  "Adventure",
                  "Animation",
                  "Comedy",
                  "Crime",
                  "Documentary",
                  "Drama",
                  "Family",
                  "Fantasy",
                  "History",
                  "Horror",
                  "Kids",
                  "Music",
                  "Mystery",
                  "Reality",
                  "Romance",
                  "Science Fiction",
                  "Thriller",
                  "War",
                  "Western",
                ],
                "type": "string",
              },
              "maxItems": 3,
              "minItems": 1,
              "type": "array",
            },
            "minRating": {
              "description": "Lowest TMDB rating, 0-10",
              "maximum": 10,
              "minimum": 0,
              "type": "number",
            },
            "minVotes": {
              "description": "Lowest TMDB vote count; replaces the default floor for top_rated, minRating and newest",
              "maximum": 9007199254740991,
              "minimum": 0,
              "type": "integer",
            },
            "originalLanguage": {
              "description": "ISO 639-1 code of the original language, e.g. "ko"",
              "maxLength": 2,
              "minLength": 2,
              "type": "string",
            },
            "sort": {
              "default": "popular",
              "description": "popular: most popular first, top_rated: best rated first, newest: latest release first",
              "enum": [
                "popular",
                "top_rated",
                "newest",
              ],
              "type": "string",
            },
            "type": {
              "description": "movie for films, tv for TV shows",
              "enum": [
                "movie",
                "tv",
              ],
              "type": "string",
            },
            "withCast": {
              "description": "Movies only: all of these people are in the cast",
              "items": {
                "description": "TMDB person id from search_person results",
                "maximum": 9007199254740991,
                "minimum": 1,
                "type": "integer",
              },
              "maxItems": 3,
              "minItems": 1,
              "type": "array",
            },
            "withCrew": {
              "description": "Movies only: all of these people are in the crew, any job",
              "items": {
                "description": "TMDB person id from search_person results",
                "maximum": 9007199254740991,
                "minimum": 1,
                "type": "integer",
              },
              "maxItems": 3,
              "minItems": 1,
              "type": "array",
            },
            "yearFrom": {
              "description": "First release year (first air year for TV), included",
              "maximum": 2100,
              "minimum": 1870,
              "type": "integer",
            },
            "yearTo": {
              "description": "Last release year, included. For one year, set both to it.",
              "maximum": 2100,
              "minimum": 1870,
              "type": "integer",
            },
          },
          "required": [
            "type",
          ],
          "type": "object",
        },
        "get_title_details": {
          "properties": {
            "id": {
              "description": "TMDB id from search or discover results",
              "maximum": 9007199254740991,
              "minimum": 1,
              "type": "integer",
            },
            "type": {
              "description": "movie for films, tv for TV shows",
              "enum": [
                "movie",
                "tv",
              ],
              "type": "string",
            },
          },
          "required": [
            "type",
            "id",
          ],
          "type": "object",
        },
        "search_titles": {
          "properties": {
            "query": {
              "description": "The title to look for, in its English form",
              "maxLength": 100,
              "minLength": 1,
              "type": "string",
            },
            "type": {
              "description": "movie for films, tv for TV shows",
              "enum": [
                "movie",
                "tv",
              ],
              "type": "string",
            },
            "year": {
              "description": "Release year (first air year for TV). Leave out when unsure: a wrong year finds nothing.",
              "maximum": 2100,
              "minimum": 1870,
              "type": "integer",
            },
          },
          "required": [
            "query",
            "type",
          ],
          "type": "object",
        },
      }
    `);
  });

  test("schemas have no $schema key and keep defaulted args optional", () => {
    for (const tool of CHAT_TOOLS) {
      expect(toolParameters(tool)).not.toHaveProperty("$schema");
    }
    const discover = toolParameters(CHAT_TOOLS[1]);
    expect(discover.required).toEqual(["type"]);
  });

  // Gemini answers 400 to every request if it rejects one keyword
  test("schemas use only keywords Gemini supports", () => {
    expect(
      CHAT_TOOLS.flatMap((tool) =>
        schemaProblems(toolParameters(tool)).map(
          (problem) => `${tool.name}: ${problem}`,
        ),
      ),
    ).toEqual([]);
  });

  // a walker that checks nothing would let the test above pass
  test("the keyword check finds unsupported keywords and types", () => {
    expect(
      schemaProblems(
        toolParameters(toolWithArgs(z.object({ a: z.string().regex(/x/) }))),
      ),
    ).toEqual(["properties.a.pattern"]);
    expect(
      schemaProblems(
        toolParameters(
          toolWithArgs(z.object({ list: z.array(z.string().regex(/x/)) })),
        ),
      ),
    ).toEqual(["properties.list.items.pattern"]);
    expect(schemaProblems({ type: "object", pattern: "x" })).toEqual([
      "pattern",
    ]);
    expect(
      schemaProblems({
        type: "object",
        properties: { a: { type: ["string", "null"] } },
        additionalProperties: { type: "string", format: "date" },
      }),
    ).toEqual([
      'properties.a.type = ["string","null"]',
      "additionalProperties.format",
    ]);
  });

  test("the keyword check skips property names and enum values", () => {
    expect(
      schemaProblems(
        toolParameters(
          toolWithArgs(
            z.object({
              pattern: z.enum(["format", "anyOf"]).default("format"),
              items: z.array(z.string()).min(1).max(3),
            }),
          ),
        ),
      ),
    ).toEqual([]);
  });
});

describe("statusFor", () => {
  it.each([
    ["search_titles", "Searching TMDB database..."],
    ["discover_titles", "Browsing TMDB database..."],
    ["get_title_details", "Checking title details..."],
    // the model's mistake
    ["get_weather", "Checking TMDB database..."],
    ["", "Checking TMDB database..."],
  ])("%j -> %j", (name, status) => {
    expect(statusFor(name)).toBe(status);
  });
});

describe("runToolCalls", () => {
  test("runs the calls in parallel and returns results in call order", async () => {
    const fury = deferred<unknown>();
    const dark = deferred<unknown>();
    const started: string[] = [];
    mockTmdb({
      ...GENRES,
      "/3/search/movie": (url: URL) => {
        const query = url.searchParams.get("query")!;
        started.push(query);
        return (query === "Fury" ? fury : dark).promise;
      },
    });

    const running = runToolCalls(
      [
        search("c1", { query: "Fury", type: "movie" }),
        search("c2", { query: "Dark", type: "movie" }),
      ],
      live(),
    );
    // sequential calls would never start the second request
    await vi.waitFor(() => expect(started).toEqual(["Fury", "Dark"]));
    dark.resolve(page([rawMovie(2)]));
    fury.resolve(page([rawMovie(1)]));
    const results = await running;

    expect(results).toEqual([
      {
        callId: "c1",
        name: "search_titles",
        isError: false,
        output: { results: [expect.objectContaining({ id: 1 })] },
      },
      {
        callId: "c2",
        name: "search_titles",
        isError: false,
        output: { results: [expect.objectContaining({ id: 2 })] },
      },
    ]);
  });

  test("already parsed arguments are used as they are", async () => {
    const spy = mockTmdb({ ...GENRES, "/3/search/movie": page([]) });

    const [result] = await runToolCalls(
      [
        {
          id: "c1",
          name: "search_titles",
          rawArgs: { query: "Fury", type: "movie" },
        },
      ],
      live(),
    );

    expect(result.isError).toBe(false);
    expect(tmdbUrls(spy, "/3/search/movie")[0].searchParams.get("query")).toBe(
      "Fury",
    );
  });

  test("defaults are applied before the handler runs", async () => {
    const spy = mockTmdb({ ...GENRES, "/3/discover/movie": page([]) });

    await runToolCalls(
      [{ id: "c1", name: "discover_titles", rawArgs: '{"type":"movie"}' }],
      live(),
    );

    const [url] = tmdbUrls(spy, "/3/discover/movie");
    expect(url.searchParams.get("sort_by")).toBe("popularity.desc");
  });

  describe("errors become results for the model", () => {
    const errorResult = (callId: string, name: string, output: string) => ({
      callId,
      name,
      output,
      isError: true,
    });

    test("an unknown tool", async () => {
      const fetch = mockTmdb({});
      expect(
        await runToolCalls(
          [{ id: "c1", name: "get_weather", rawArgs: "{}" }],
          live(),
        ),
      ).toEqual([
        errorResult("c1", "get_weather", "Unknown tool: get_weather"),
      ]);
      expect(fetch).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledOnce();
    });

    test("arguments that aren't JSON", async () => {
      const fetch = mockTmdb({});
      expect(await runToolCalls([search("c1", '{"query":')], live())).toEqual([
        errorResult("c1", "search_titles", "Arguments are not valid JSON"),
      ]);
      expect(fetch).not.toHaveBeenCalled();
    });

    test("arguments that fail validation list the issues", async () => {
      const fetch = mockTmdb({});
      expect(
        await runToolCalls(
          [search("c1", { query: "Fury", type: "movie", year: 2014.5 })],
          live(),
        ),
      ).toEqual([
        errorResult(
          "c1",
          "search_titles",
          "Invalid arguments: year: Invalid input: expected int, received number",
        ),
      ]);
      expect(fetch).not.toHaveBeenCalled();
    });

    test("empty arguments are validated as {}", async () => {
      const [result] = await runToolCalls(
        [{ id: "c1", name: "get_title_details", rawArgs: " " }],
        live(),
      );
      expect(result.output).toBe(
        'Invalid arguments: type: Invalid option: expected one of "movie"|"tv"; id: Invalid input: expected number, received undefined',
      );
    });

    test("a failed TMDB request names only the status", async () => {
      mockTmdb({
        ...GENRES,
        "/3/search/movie": new Response("secret details", { status: 503 }),
      });

      const [result] = await runToolCalls(
        [search("c1", { query: "Fury", type: "movie" })],
        live(),
      );

      expect(result).toEqual(
        errorResult("c1", "search_titles", "TMDB request failed (status 503)"),
      );
      expect(console.error).toHaveBeenCalledWith(
        "Tool search_titles failed:",
        expect.objectContaining({ name: "TmdbError", status: 503 }),
      );
    });

    test("other failures don't leak URLs or tokens to the model", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new TypeError(
          "fetch failed: https://tmdb.test/3/search/movie Bearer test-tmdb-token",
        ),
      );

      const [result] = await runToolCalls(
        [search("c1", { query: "Fury", type: "movie" })],
        live(),
      );

      expect(result).toEqual(errorResult("c1", "search_titles", "Tool failed"));
      expect(console.error).toHaveBeenCalledWith(
        "Tool search_titles failed:",
        expect.any(TypeError),
      );
    });

    test("a ToolError passes its message on", async () => {
      mockTmdb(GENRES);

      const [result] = await runToolCalls(
        [
          {
            id: "c1",
            name: "discover_titles",
            rawArgs: '{"type":"tv","genres":["Horror"]}',
          },
        ],
        live(),
      );

      expect(result.isError).toBe(true);
      expect(result.output).toMatch(
        /^"Horror" isn't a TMDB TV genre\. Valid TV genres: Action, /,
      );
      // the model's mistake: a warning, not a server error
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^Tool call discover_titles rejected: "Horror" isn't a TMDB TV genre/,
        ),
      );
      expect(console.error).not.toHaveBeenCalled();
    });

    test("a call that takes over 8 s times out", async () => {
      vi.useFakeTimers();
      const spy = mockTmdb({ ...GENRES, "/3/search/movie": hangUntilAborted });
      let settled = false;

      const running = runToolCalls(
        [search("c1", { query: "Fury", type: "movie" })],
        live(),
      ).finally(() => (settled = true));
      await vi.advanceTimersByTimeAsync(7999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      expect(await running).toEqual([
        errorResult("c1", "search_titles", "TMDB request timed out"),
      ]);
      const searchCall = spy.mock.calls.find(([url]) =>
        String(url).includes("/search/movie"),
      );
      expect(searchCall?.[1]?.signal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    });

    test("a fast call clears its timeout", async () => {
      vi.useFakeTimers();
      mockTmdb({ ...GENRES, "/3/search/movie": page([]) });
      await runToolCalls(
        [search("c1", { query: "Fury", type: "movie" })],
        live(),
      );
      expect(vi.getTimerCount()).toBe(0);
    });

    test(`only ${MAX_CALLS_PER_ROUND} calls run per round, every call gets a result`, async () => {
      const spy = mockTmdb({ ...GENRES, "/3/search/movie": page([]) });
      const calls = Array.from({ length: MAX_CALLS_PER_ROUND + 1 }, (_, i) =>
        search(`c${i + 1}`, { query: `Title ${i + 1}`, type: "movie" }),
      );

      const results = await runToolCalls(calls, live());

      expect(results.map((r) => r.callId)).toEqual(calls.map((c) => c.id));
      expect(results.slice(0, -1).every((r) => !r.isError)).toBe(true);
      expect(results.at(-1)).toEqual(
        errorResult(
          "c11",
          "search_titles",
          "Too many calls in one round (max 10)",
        ),
      );
      expect(
        tmdbUrls(spy, "/3/search/movie").map((u) =>
          u.searchParams.get("query"),
        ),
      ).toEqual(Array.from({ length: 10 }, (_, i) => `Title ${i + 1}`));
    });
  });

  describe("abort", () => {
    test("rejects with the abort reason instead of returning results", async () => {
      const spy = mockTmdb({ ...GENRES, "/3/search/movie": hangUntilAborted });
      const controller = new AbortController();

      const running = runToolCalls(
        [
          search("c1", { query: "Fury", type: "movie" }),
          { id: "c2", name: "get_weather", rawArgs: "{}" },
        ],
        controller.signal,
      );
      await vi.waitFor(() =>
        expect(tmdbUrls(spy, "/3/search/movie")).toHaveLength(1),
      );
      controller.abort();

      await expect(running).rejects.toBe(controller.signal.reason);
      expect(console.error).not.toHaveBeenCalled();
    });

    test("an already aborted signal rejects and hands the aborted signal to fetch", async () => {
      const spy = mockTmdb({ ...GENRES, "/3/search/movie": hangUntilAborted });
      const controller = new AbortController();
      controller.abort();

      await expect(
        runToolCalls(
          [search("c1", { query: "Fury", type: "movie" })],
          controller.signal,
        ),
      ).rejects.toBe(controller.signal.reason);
      // fetch is called with the aborted signal; a real fetch rejects at once
      expect(spy).toHaveBeenCalled();
      for (const [, init] of spy.mock.calls) {
        expect(init?.signal?.aborted).toBe(true);
      }
    });
  });
});
