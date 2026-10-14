import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "@/app/api/assistant/route";
import { auth } from "@/infra/auth/auth";
import {
  CHAT_MODEL,
  CHAT_THINKING_LEVEL,
  MAX_TOOL_ROUNDS,
  buildSystemInstruction,
} from "./chatConfig";
import {
  MAX_LIST_CHANGES,
  MAX_PROMPT_LENGTH,
  MAX_STOPPED_TEXT_LENGTH,
  MAX_STOPPED_TURNS,
} from "./chatLimits";
import { toGeminiTools } from "./llm/geminiTools";
import { FINAL_ROUND_TOOL_CHOICE } from "./llm/llmService";
import { CHAT_TOOLS } from "./tools/registry";
import { asUser } from "@test/helpers/auth";
import { getMovies, seedList, seedUser } from "@test/helpers/db";
import { deferred } from "@test/helpers/deferred";
import { makeMovie } from "@test/helpers/factories";
import { jsonRequest } from "@test/helpers/requests";
import {
  hangUntilAborted,
  mockTmdb,
  tmdbFixture,
  tmdbUrls,
} from "@test/helpers/tmdb";
import {
  argsDelta,
  completed,
  created,
  functionCall,
  geminiEvents,
  readNdjson,
  requiresAction,
  stepStop,
  textDelta,
  toolCall,
} from "./testing/stream";
import {
  MOVIE_GENRES,
  TV_GENRES,
  page,
  rawDetails,
  rawMovie,
  rawPerson,
  rawShow,
} from "./testing/tmdbData";

const { create, get, ctor } = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  ctor: vi.fn(),
}));
vi.mock("@google/genai", () => ({
  // `function`, not arrow: the route calls `new GoogleGenAI(...)` (Vitest 4)
  GoogleGenAI: vi.fn(function (opts: unknown) {
    ctor(opts);
    return { interactions: { create, get } };
  }),
}));

vi.mock("@/infra/auth/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

beforeEach(() => {
  vi.stubEnv("AI_CHAT_ENABLED", "true");
  create.mockReset();
  get.mockReset();
  asUser(null);
});
afterEach(() => {
  vi.useRealTimers();
});

const post = (body: unknown) =>
  POST(jsonRequest("POST", "/api/assistant", body) as NextRequest);

// the signal passed to the last interactions.create call
const geminiSignal = () => create.mock.lastCall?.[1]?.signal as AbortSignal;

// Gemini stream that starts, then hangs until the request is aborted and
// throws like the SDK does
async function* startedThenAborted() {
  yield created();
  const signal = geminiSignal();
  await new Promise((_, reject) =>
    signal.addEventListener("abort", () =>
      reject(new DOMException("aborted", "AbortError")),
    ),
  );
}

// lets the route's stream finish handling an abort
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const decoder = new TextDecoder();
const readLine = async (reader: ReadableStreamDefaultReader<Uint8Array>) =>
  JSON.parse(decoder.decode((await reader.read()).value));

describe("POST /api/assistant", () => {
  it.each(["", "false", "TRUE"])(
    "returns 503 when AI_CHAT_ENABLED is %j",
    async (value) => {
      vi.stubEnv("AI_CHAT_ENABLED", value);
      const res = await post({ content: "hi" });
      expect(res.status).toBe(503);
      expect(create).not.toHaveBeenCalled();
    },
  );

  it.each([
    {},
    { content: 42 },
    { content: null },
    { content: "   " },
    { content: "a".repeat(MAX_PROMPT_LENGTH + 1) },
  ])("returns 400 for invalid content %#", async (body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  test("accepts exactly MAX_PROMPT_LENGTH characters", async () => {
    create.mockResolvedValue(geminiEvents([]));
    const res = await post({ content: "a".repeat(MAX_PROMPT_LENGTH) });
    expect(res.status).toBe(200);
  });

  it.each([42, {}, true])(
    "returns 400 for previousInteractionId %j",
    async (previousInteractionId) => {
      const res = await post({ content: "hi", previousInteractionId });
      expect(res.status).toBe(400);
      expect(create).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["null", { previousInteractionId: null }],
    ["a missing key", {}],
  ])("accepts %s as previousInteractionId", async (_, extra) => {
    create.mockResolvedValue(geminiEvents([]));
    const res = await post({ content: "hi", ...extra });
    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ previous_interaction_id: undefined }),
      expect.anything(),
    );
  });

  describe("stopped turns", () => {
    const turn = (prompt: unknown = "p1", partialText: unknown = "A") => ({
      prompt,
      partialText,
    });

    it.each([
      ["not an array", turn()],
      [
        "more than MAX_STOPPED_TURNS",
        Array(MAX_STOPPED_TURNS + 1).fill(turn()),
      ],
      ["a prompt that isn't a string", [turn(42)]],
      ["a whitespace-only prompt", [turn("   ")]],
      [
        "a prompt over MAX_PROMPT_LENGTH",
        [turn("a".repeat(MAX_PROMPT_LENGTH + 1))],
      ],
      ["a missing partialText", [{ prompt: "p1" }]],
      ["a partialText that isn't a string", [turn("p1", null)]],
      [
        "a partialText over MAX_STOPPED_TEXT_LENGTH",
        [turn("p1", "a".repeat(MAX_STOPPED_TEXT_LENGTH + 1))],
      ],
    ])("returns 400 for %s", async (_, stoppedTurns) => {
      const res = await post({ content: "hi", stoppedTurns });
      expect(res.status).toBe(400);
      expect(create).not.toHaveBeenCalled();
    });

    test("accepts the exact limits", async () => {
      create.mockResolvedValue(geminiEvents([]));
      const stoppedTurns = Array(MAX_STOPPED_TURNS).fill(
        turn(
          "a".repeat(MAX_PROMPT_LENGTH),
          "b".repeat(MAX_STOPPED_TEXT_LENGTH),
        ),
      );
      const res = await post({ content: "hi", stoppedTurns });
      expect(res.status).toBe(200);
    });

    test("an empty list sends the plain prompt", async () => {
      create.mockResolvedValue(geminiEvents([]));
      await post({ content: "hi", stoppedTurns: [] });
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ input: "hi" }),
        expect.anything(),
      );
    });

    test("are passed to Gemini as steps before the prompt, with the history", async () => {
      create.mockResolvedValue(geminiEvents([]));
      const text = (t: string) => [{ type: "text", text: t }];

      const res = await post({
        content: "p3",
        previousInteractionId: "i1",
        stoppedTurns: [turn("p1", "A"), turn("p2", "")],
      });

      expect(res.status).toBe(200);
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          previous_interaction_id: "i1",
          input: [
            { type: "user_input", content: text("p1") },
            { type: "model_output", content: text("A") },
            { type: "user_input", content: text("p2") },
            { type: "user_input", content: text("p3") },
          ],
        }),
        expect.anything(),
      );
    });
  });

  test("passes the prompt, model, history and system instruction to Gemini", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-01T10:00:00Z"));
    create.mockResolvedValue(geminiEvents([]));

    await post({ content: "hi", previousInteractionId: "prev" });

    expect(ctor).toHaveBeenCalledWith({ apiKey: "test-gemini-key" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: CHAT_MODEL,
        input: "hi",
        previous_interaction_id: "prev",
        stream: true,
        system_instruction: buildSystemInstruction(
          new Date("2026-05-01T10:00:00Z"),
        ),
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  describe("sign-in state", () => {
    const instruction = () =>
      create.mock.lastCall?.[0].system_instruction as string;

    test("signed in: the prompt says so", async () => {
      asUser(await seedUser());
      create.mockResolvedValue(geminiEvents([]));
      await post({ content: "hi" });
      expect(instruction()).toContain("The user is signed in.");
    });

    test("signed out: the prompt says so", async () => {
      create.mockResolvedValue(geminiEvents([]));
      await post({ content: "hi" });
      expect(instruction()).toContain("The user is signed out.");
    });

    test("an unreadable session: the prompt says neither", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(auth as unknown as () => Promise<unknown>).mockRejectedValue(
        new Error("db down"),
      );
      create.mockResolvedValue(geminiEvents([]));
      await post({ content: "hi" });
      expect(instruction()).not.toMatch(/The user is signed (in|out)\./);
    });
  });

  describe("list changes", () => {
    const text = (t: string) => [{ type: "text", text: t }];
    const key = (movieId: unknown = 228150, type: unknown = "movie") => ({
      movieId,
      type,
    });
    const input = () => create.mock.lastCall?.[0].input;

    it.each([
      ["not an array", key()],
      ["more than MAX_LIST_CHANGES", Array(MAX_LIST_CHANGES + 1).fill(key())],
      ["a movieId that isn't a number", [key("228150")]],
      ["a movieId that isn't positive", [key(0)]],
      ["a movieId that isn't an integer", [key(1.5)]],
      ["an unknown type", [key(1, "person")]],
      ["a missing type", [{ movieId: 1 }]],
    ])("returns 400 for %s", async (_, listChanges) => {
      const res = await post({ content: "hi", listChanges });
      expect(res.status).toBe(400);
      expect(create).not.toHaveBeenCalled();
    });

    test("signed in: a note with the entries' state from the DB, after the stopped turns", async () => {
      const user = await seedUser();
      await seedList(user.id, [
        makeMovie({
          movieId: 693134,
          name: "Dune: Part Two",
          status: "Completed",
        }),
        makeMovie({
          movieId: 1396,
          type: "tv",
          name: "Breaking Bad",
          status: "Watching",
        }),
      ]);
      asUser(user);
      create.mockResolvedValue(geminiEvents([]));

      const res = await post({
        content: "is Fury in my list?",
        stoppedTurns: [{ prompt: "p1", partialText: "A" }],
        listChanges: [key(693134), key(228150), key(1396, "tv")],
      });

      expect(res.status).toBe(200);
      expect(input()).toEqual([
        { type: "user_input", content: text("p1") },
        { type: "model_output", content: text("A") },
        {
          type: "user_input",
          content: text(
            "[List update: Dune: Part Two (movie 693134) is Completed; movie 228150 is not in the list; Breaking Bad (tv 1396) is Watching]",
          ),
        },
        { type: "user_input", content: text("is Fury in my list?") },
      ]);
    });

    test("another user's entries aren't in the note", async () => {
      const user = await seedUser();
      const other = await seedUser();
      await seedList(other.id, [makeMovie({ movieId: 228150 })]);
      asUser(user);
      create.mockResolvedValue(geminiEvents([]));

      await post({ content: "hi", listChanges: [key()] });

      expect(input()).toEqual([
        {
          type: "user_input",
          content: text("[List update: movie 228150 is not in the list]"),
        },
        { type: "user_input", content: text("hi") },
      ]);
    });

    test("signed out: no note", async () => {
      create.mockResolvedValue(geminiEvents([]));
      const res = await post({ content: "hi", listChanges: [key()] });
      expect(res.status).toBe(200);
      expect(input()).toBe("hi");
    });

    test("an empty list: no note", async () => {
      asUser(await seedUser());
      create.mockResolvedValue(geminiEvents([]));
      await post({ content: "hi", listChanges: [] });
      expect(input()).toBe("hi");
    });
  });

  test("returns 502 when interactions.create throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    create.mockRejectedValue(new Error("quota"));
    const res = await post({ content: "hi" });
    expect(res.status).toBe(502);
  });

  describe("an expired conversation", () => {
    // what the SDK throws, live: NotFoundError for a deleted or unknown
    // interaction, BadRequestError for an invalid key
    const apiError = (status: number, message: string) =>
      Object.assign(new Error(`${status} ${message}`), { status });
    const notFound = () => apiError(404, "Requested entity was not found.");

    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "info").mockImplementation(() => {});
    });

    test("returns 409 when the previous interaction is gone", async () => {
      create.mockRejectedValue(notFound());
      get.mockRejectedValue(notFound());

      const res = await post({
        content: "hi",
        previousInteractionId: "v1_old",
      });

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "conversation_expired" });
      expect(get).toHaveBeenCalledWith(
        "v1_old",
        null,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(console.error).not.toHaveBeenCalled();
    });

    test("without a previous interaction the same error is a 502", async () => {
      create.mockRejectedValue(notFound());

      const res = await post({ content: "hi" });

      expect(res.status).toBe(502);
      expect(get).not.toHaveBeenCalled();
    });

    it.each([
      ["an invalid key", apiError(400, "API error occurred")],
      ["a quota error", apiError(429, "Resource exhausted")],
      ["a network failure", new TypeError("fetch failed")],
    ])("returns 502 when the lookup fails with %s", async (_, error) => {
      create.mockRejectedValue(error);
      get.mockRejectedValue(error);

      const res = await post({
        content: "hi",
        previousInteractionId: "v1_old",
      });

      expect(res.status).toBe(502);
      expect(console.error).toHaveBeenCalled();
    });

    test("returns 502 when the previous interaction still exists", async () => {
      create.mockRejectedValue(
        apiError(400, "Request contains an invalid argument."),
      );
      get.mockResolvedValue({ id: "v1_old", status: "completed" });

      const res = await post({
        content: "hi",
        previousInteractionId: "v1_old",
      });

      expect(res.status).toBe(502);
    });
  });

  test("responds with Content-Type application/x-ndjson", async () => {
    create.mockResolvedValue(geminiEvents([]));
    const res = await post({ content: "hi" });
    expect(res.headers.get("content-type")).toBe("application/x-ndjson");
  });

  describe("stream mapping", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    test("maps Gemini events to NDJSON and skips non-text deltas", async () => {
      create.mockResolvedValue(
        geminiEvents([
          created(),
          textDelta("Hel"),
          { event_type: "step.delta", delta: { type: "thought", text: "hmm" } },
          textDelta("lo"),
          completed(),
        ]),
      );

      const { events } = await readNdjson(await post({ content: "hi" }));

      expect(events).toEqual([
        { type: "start", interactionId: "i1" },
        { type: "delta", text: "Hel" },
        { type: "delta", text: "lo" },
        { type: "done", interactionId: "i1" },
      ]);
    });

    test("a non-completed status ends with an error event", async () => {
      create.mockResolvedValue(
        geminiEvents([created(), completed("i1", "failed")]),
      );
      const { events } = await readNdjson(await post({ content: "hi" }));
      expect(events.at(-1)).toEqual({ type: "error" });
    });

    test("an error event becomes an error line", async () => {
      create.mockResolvedValue(
        geminiEvents([
          created(),
          { event_type: "error", error: { code: "x", message: "boom" } },
        ]),
      );
      const { events } = await readNdjson(await post({ content: "hi" }));
      expect(events.at(-1)).toEqual({ type: "error" });
    });

    test("a throw mid-stream sends an error line and closes the stream", async () => {
      create.mockResolvedValue(
        geminiEvents([created(), textDelta("Hi"), completed()], 2),
      );

      const { events } = await readNdjson(await post({ content: "hi" }));

      expect(events).toEqual([
        { type: "start", interactionId: "i1" },
        { type: "delta", text: "Hi" },
        { type: "error" },
      ]);
    });

    test("every line is JSON terminated by \\n", async () => {
      create.mockResolvedValue(
        geminiEvents([created(), textDelta('a "quoted"\nline'), completed()]),
      );

      const { text } = await readNdjson(await post({ content: "hi" }));

      expect(text.endsWith("\n")).toBe(true);
      const lines = text.split("\n").slice(0, -1);
      expect(lines).toHaveLength(3);
      for (const line of lines) expect(() => JSON.parse(line)).not.toThrow();
    });
  });

  describe("client disconnect", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "info").mockImplementation(() => {});
    });

    test("cancelling the response aborts the Gemini request quietly", async () => {
      create.mockImplementation(async () => startedThenAborted());
      const res = await post({ content: "hi" });
      const reader = res.body!.getReader();
      expect(await readLine(reader)).toEqual({
        type: "start",
        interactionId: "i1",
      });

      await reader.cancel();
      await flush();

      expect(geminiSignal().aborted).toBe(true);
      expect(console.info).toHaveBeenCalledWith(
        "Chat stream cancelled by the client",
      );
      expect(console.error).not.toHaveBeenCalled();
    });

    test("an aborted request aborts the Gemini request, with no error line or log", async () => {
      create.mockImplementation(async () => startedThenAborted());
      const client = new AbortController();
      const request = new Request(
        jsonRequest("POST", "/api/assistant", { content: "hi" }),
        { signal: client.signal },
      );
      const res = await POST(request as NextRequest);
      const reader = res.body!.getReader();
      await readLine(reader); // start

      client.abort();

      expect((await reader.read()).done).toBe(true);
      expect(geminiSignal().aborted).toBe(true);
      expect(console.error).not.toHaveBeenCalled();
    });

    test("an abort while Gemini is starting doesn't log a 502", async () => {
      const client = new AbortController();
      create.mockImplementation(async () => {
        client.abort();
        throw new DOMException("aborted", "AbortError");
      });
      const request = new Request(
        jsonRequest("POST", "/api/assistant", { content: "hi" }),
        { signal: client.signal },
      );

      const res = await POST(request as NextRequest);

      expect(res.status).toBe(499);
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  test("[B11] returns 400 for a malformed JSON body", async () => {
    const res = await POST(
      jsonRequest("POST", "/api/assistant", "{not json") as NextRequest,
    );
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  test("returns 400 for a JSON null body", async () => {
    const res = await post(null);
    expect(res.status).toBe(400);
  });

  describe("tool loop", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "info").mockImplementation(() => {});
    });

    const searching = (id: string) => ({
      type: "tool_start",
      id,
      name: "search_titles",
      text: "Searching TMDB database...",
    });
    const ended = (id: string) => ({ type: "tool_end", id });
    const FURY = rawMovie(228150, { title: "Fury" });
    const FURY_ITEM = {
      id: 228150,
      type: "movie",
      title: "Fury",
      year: 2014,
      rating: 7.5,
      votes: 1234,
      genres: ["War", "Drama"],
    };

    const tmdb = (routes: Record<string, unknown> = {}) =>
      mockTmdb({
        "/3/genre/movie/list": MOVIE_GENRES,
        "/3/genre/tv/list": TV_GENRES,
        "/3/search/movie": page([FURY]),
        ...routes,
      });

    type Call = { id: string; name: string; args: object };
    const searchCall = (id: string, query = "Fury"): Call => ({
      id,
      name: "search_titles",
      args: { query, type: "movie" },
    });

    // a round that asks for the calls, as the real API streams it
    const toolRound = (id: string, ...calls: Call[]) => [
      created(id),
      ...calls.flatMap((call, i) => toolCall(i + 1, call)),
      requiresAction(id),
    ];
    const answerRound = (id: string, ...texts: string[]) => [
      created(id),
      ...texts.map(textDelta),
      completed(id),
    ];
    // one interactions.create result per round, in order
    const rounds = (...events: object[][]) => {
      for (const round of events) {
        create.mockResolvedValueOnce(geminiEvents(round));
      }
    };
    const request = (n: number) => create.mock.calls[n][0];
    const results = (n: number) => request(n).input;
    const toolChoices = () =>
      create.mock.calls.map(([body]) => body.generation_config.tool_choice);

    const FURY_DETAILS = rawDetails(228150, { title: "Fury" });
    // the titles match FURY_DETAILS and rawDetails' default
    const showCall = (id: string, ...ids: number[]): Call => ({
      id,
      name: "show_recommendations",
      args: {
        items: ids.map((titleId) => ({
          type: "movie",
          id: titleId,
          title: titleId === 228150 ? "Fury" : `Movie ${titleId}`,
          reason: `Reason ${titleId}.`,
        })),
      },
    });
    const preparing = (id: string) => ({
      type: "tool_start",
      id,
      name: "show_recommendations",
      text: "Preparing recommendations...",
    });

    test("one round: runs the call and continues the interaction with its result", async () => {
      const spy = tmdb();
      rounds(
        toolRound("i1", searchCall("c1")),
        answerRound("i2", "Watch ", "Fury."),
      );

      const { events } = await readNdjson(await post({ content: "war" }));

      expect(events).toEqual([
        { type: "start", interactionId: "i1" },
        searching("c1"),
        ended("c1"),
        { type: "delta", text: "Watch " },
        { type: "delta", text: "Fury." },
        { type: "done", interactionId: "i2" },
      ]);
      expect(create).toHaveBeenCalledTimes(2);
      const tools = toGeminiTools(CHAT_TOOLS);
      expect(request(0)).toMatchObject({
        tools,
        generation_config: {
          thinking_level: CHAT_THINKING_LEVEL,
          tool_choice: "auto",
        },
      });
      expect(request(1)).toEqual({
        model: CHAT_MODEL,
        previous_interaction_id: "i1",
        input: [
          {
            type: "function_result",
            call_id: "c1",
            name: "search_titles",
            result: { results: [FURY_ITEM] },
          },
        ],
        tools,
        system_instruction: request(0).system_instruction,
        generation_config: {
          thinking_level: CHAT_THINKING_LEVEL,
          tool_choice: "auto",
        },
        stream: true,
      });
      // a stop aborts every round
      expect(create.mock.calls[1][1].signal).toBe(
        create.mock.calls[0][1].signal,
      );
      const [search] = tmdbUrls(spy, "/3/search/movie");
      expect(search.searchParams.get("query")).toBe("Fury");
      expect(console.info).toHaveBeenCalledWith(
        expect.stringMatching(
          /^Tool round 1: search_titles \(\d+ ms, 0 errors\)$/,
        ),
      );
    });

    // the real tools across rounds: the id from round 1's result goes into
    // round 2's call
    test("two rounds: search_person, then discover_titles with the person's id", async () => {
      const spy = tmdb({
        "/3/search/person": page([rawPerson(287, { name: "Brad Pitt" })]),
        "/3/discover/movie": page([FURY]),
      });
      rounds(
        toolRound("i1", {
          id: "c1",
          name: "search_person",
          args: { query: "Brad Pitt" },
        }),
        toolRound("i2", {
          id: "c2",
          name: "discover_titles",
          args: { type: "movie", withCast: [287], genres: ["War"] },
        }),
        answerRound("i3", "Watch Fury."),
      );

      const { events } = await readNdjson(
        await post({ content: "war movies with Brad Pitt" }),
      );

      expect(events).toEqual([
        { type: "start", interactionId: "i1" },
        {
          type: "tool_start",
          id: "c1",
          name: "search_person",
          text: "Searching people...",
        },
        ended("c1"),
        {
          type: "tool_start",
          id: "c2",
          name: "discover_titles",
          text: "Browsing TMDB database...",
        },
        ended("c2"),
        { type: "delta", text: "Watch Fury." },
        { type: "done", interactionId: "i3" },
      ]);
      expect(create).toHaveBeenCalledTimes(3);
      expect(request(1)).toMatchObject({ previous_interaction_id: "i1" });
      expect(results(1)).toEqual([
        {
          type: "function_result",
          call_id: "c1",
          name: "search_person",
          result: {
            results: [expect.objectContaining({ id: 287, name: "Brad Pitt" })],
          },
        },
      ]);
      const [discover] = tmdbUrls(spy, "/3/discover/movie");
      expect(discover.searchParams.get("with_cast")).toBe("287");
      expect(discover.searchParams.get("with_genres")).toBe("10752");
      expect(request(2)).toMatchObject({
        previous_interaction_id: "i2",
        generation_config: { tool_choice: "auto" },
      });
      expect(results(2)).toEqual([
        {
          type: "function_result",
          call_id: "c2",
          name: "discover_titles",
          result: { results: [FURY_ITEM] },
        },
      ]);
    });

    test("parallel calls: all requests start at once, results come back in call order", async () => {
      const fury = deferred<unknown>();
      const dark = deferred<unknown>();
      const started: string[] = [];
      tmdb({
        "/3/search/movie": (url: URL) => {
          const query = url.searchParams.get("query")!;
          started.push(query);
          return (query === "Fury" ? fury : dark).promise;
        },
      });
      rounds(
        toolRound("i1", searchCall("c1", "Fury"), searchCall("c2", "Dark")),
        answerRound("i2", "Done."),
      );

      const reading = readNdjson(await post({ content: "war" }));
      // run one by one, the second request would wait for the first
      await vi.waitFor(() => expect(started).toEqual(["Fury", "Dark"]));
      dark.resolve(page([rawMovie(2)]));
      fury.resolve(page([FURY]));
      const { events } = await reading;

      expect(results(1)).toEqual([
        expect.objectContaining({
          call_id: "c1",
          result: { results: [FURY_ITEM] },
        }),
        expect.objectContaining({
          call_id: "c2",
          result: { results: [expect.objectContaining({ id: 2 })] },
        }),
      ]);
      // a start per call as it streams, an end per call once the round is done
      expect(events).toEqual([
        { type: "start", interactionId: "i1" },
        searching("c1"),
        searching("c2"),
        ended("c1"),
        ended("c2"),
        { type: "delta", text: "Done." },
        { type: "done", interactionId: "i2" },
      ]);
    });

    test("arguments split over deltas are joined per step index", async () => {
      const spy = tmdb({
        "/3/search/tv": page([rawShow(70523)]),
        "/3/movie/550": tmdbFixture("movie-550"),
      });
      rounds(
        [
          created("i1"),
          functionCall(1, { id: "c1", name: "search_titles" }),
          argsDelta(1, '{"query":"Fu'),
          functionCall(2, { id: "c2", name: "search_titles" }),
          argsDelta(2, '{"query":"Dark",'),
          argsDelta(1, 'ry","type":"mo'),
          argsDelta(2, '"type":"tv"}'),
          argsDelta(1, 'vie","year":2014}'),
          stepStop(1),
          stepStop(2),
          // no deltas: the arguments on step.start are used
          functionCall(3, {
            id: "c3",
            name: "get_title_details",
            args: { type: "movie", id: 550 },
          }),
          requiresAction("i1"),
        ],
        answerRound("i2", "Done."),
      );

      await readNdjson(await post({ content: "war" }));

      expect(
        results(1).map((r: { call_id: string; is_error?: boolean }) => [
          r.call_id,
          r.is_error,
        ]),
      ).toEqual([
        ["c1", undefined],
        ["c2", undefined],
        ["c3", undefined],
      ]);
      const [movie] = tmdbUrls(spy, "/3/search/movie");
      expect(movie.searchParams.get("query")).toBe("Fury");
      expect(movie.searchParams.get("primary_release_year")).toBe("2014");
      const [tv] = tmdbUrls(spy, "/3/search/tv");
      expect(tv.searchParams.get("query")).toBe("Dark");
      expect(tmdbUrls(spy, "/3/movie/550")).toHaveLength(1);
    });

    describe("show_recommendations", () => {
      test("streams the cards after the round's tool_end; the model gets only shown and notShown", async () => {
        tmdb({
          "/3/movie/228150": rawDetails(228150, {
            title: "Fury",
            poster_path: "/fury.jpg",
          }),
        });
        rounds(
          [
            created("i1"),
            textDelta("Here are some war films."),
            ...toolCall(1, showCall("c1", 228150, 404)),
            requiresAction("i1"),
          ],
          answerRound("i2"),
        );

        const { events } = await readNdjson(await post({ content: "war" }));

        expect(events).toEqual([
          { type: "start", interactionId: "i1" },
          { type: "delta", text: "Here are some war films." },
          preparing("c1"),
          ended("c1"),
          {
            type: "cards",
            items: [
              {
                type: "movie",
                id: 228150,
                title: "Fury",
                year: 2014,
                rating: 7.5,
                genres: ["War", "Drama"],
                posterPath: "/fury.jpg",
                backdropPath: "/b.jpg",
                reason: "Reason 228150.",
              },
            ],
          },
          { type: "done", interactionId: "i2" },
        ]);
        // the cards are shown: the model only writes text now
        expect(toolChoices()).toEqual(["auto", "none"]);
        expect(results(1)).toEqual([
          {
            type: "function_result",
            call_id: "c1",
            name: "show_recommendations",
            result: {
              shown: [
                {
                  position: 1,
                  id: 228150,
                  type: "movie",
                  title: "Fury",
                  year: 2014,
                },
              ],
              notShown: [
                { id: 404, type: "movie", reason: "not found on TMDB" },
              ],
            },
          },
        ]);
        expect(JSON.stringify(results(1))).not.toContain("fury.jpg");
      });

      test("no title found: no cards event, the model may look again", async () => {
        tmdb();
        rounds(toolRound("i1", showCall("c1", 1, 2)), answerRound("i2", "."));

        const { events } = await readNdjson(await post({ content: "war" }));

        expect(events.some((e) => e.type === "cards")).toBe(false);
        expect(toolChoices()).toEqual(["auto", "auto"]);
        expect(results(1)[0].result).toEqual({
          shown: [],
          notShown: [
            { id: 1, type: "movie", reason: "not found on TMDB" },
            { id: 2, type: "movie", reason: "not found on TMDB" },
          ],
        });
      });
    });

    describe("round cap", () => {
      // Gemini asks for another search every round, except the responses
      // given by request number (1-based)
      const alwaysTools = (responses: Record<number, object[]> = {}) =>
        create.mockImplementation(async () => {
          const n = create.mock.calls.length;
          return geminiEvents(
            responses[n] ?? toolRound(`i${n}`, searchCall(`c${n}`)),
          );
        });
      // the response to the request after the last lookup round
      const LAST = MAX_TOOL_ROUNDS + 1;

      test(`after ${MAX_TOOL_ROUNDS} tool rounds the last request allows only show_recommendations and save_to_list`, async () => {
        const spy = tmdb();
        alwaysTools({ [LAST]: answerRound(`i${LAST}`, "Here you go.") });

        const { events } = await readNdjson(await post({ content: "war" }));

        expect(create).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS + 1);
        expect(toolChoices()).toEqual([
          "auto",
          "auto",
          "auto",
          "auto",
          FINAL_ROUND_TOOL_CHOICE,
        ]);
        expect(FINAL_ROUND_TOOL_CHOICE).toEqual({
          allowed_tools: {
            mode: "validated",
            tools: ["show_recommendations", "save_to_list"],
          },
        });
        expect(
          create.mock.calls.map(([body]) => body.previous_interaction_id),
        ).toEqual([undefined, "i1", "i2", "i3", "i4"]);
        expect(tmdbUrls(spy, "/3/search/movie")).toHaveLength(MAX_TOOL_ROUNDS);
        expect(events.at(-1)).toEqual({ type: "done", interactionId: "i5" });
      });

      test("show_recommendations in the last round runs, then tools are forbidden", async () => {
        tmdb({ "/3/movie/228150": FURY_DETAILS });
        alwaysTools({
          [LAST]: toolRound(`i${LAST}`, showCall("c-show", 228150)),
          [LAST + 1]: answerRound(`i${LAST + 1}`, "Enjoy."),
        });

        const { events } = await readNdjson(await post({ content: "war" }));

        expect(toolChoices().slice(-2)).toEqual([
          FINAL_ROUND_TOOL_CHOICE,
          "none",
        ]);
        expect(events.slice(-5)).toEqual([
          preparing("c-show"),
          ended("c-show"),
          {
            type: "cards",
            items: [expect.objectContaining({ id: 228150 })],
          },
          { type: "delta", text: "Enjoy." },
          { type: "done", interactionId: `i${LAST + 1}` },
        ]);
      });

      test("save_to_list in the last round runs, then the model may still save", async () => {
        const user = await seedUser();
        asUser(user);
        tmdb({ "/3/movie/228150": FURY_DETAILS });
        alwaysTools({
          [LAST]: toolRound(`i${LAST}`, {
            id: "c-save",
            name: "save_to_list",
            args: { type: "movie", id: 228150, title: "Fury" },
          }),
          [LAST + 1]: answerRound(`i${LAST + 1}`, "Added."),
        });

        const { events } = await readNdjson(await post({ content: "war" }));

        // a save isn't the cards, but the rounds are used up
        expect(toolChoices().slice(-2)).toEqual([
          FINAL_ROUND_TOOL_CHOICE,
          "none",
        ]);
        expect(events).toContainEqual(
          expect.objectContaining({ type: "list_saved" }),
        );
        expect(await getMovies(user.id)).toEqual([
          makeMovie({
            movieId: 228150,
            name: "Fury",
            image: "/b.jpg",
            status: "Planning to watch",
          }),
        ]);
      });

      const REFUSED = "No more tool calls in this answer: reply in text";

      test("a lookup call in the last round isn't run; Gemini gets one more request, with none", async () => {
        const spy = tmdb();
        alwaysTools({ [LAST + 1]: answerRound(`i${LAST + 1}`, "Sorry.") });

        const { events } = await readNdjson(await post({ content: "war" }));

        expect(create).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS + 2);
        expect(toolChoices().slice(-2)).toEqual([
          FINAL_ROUND_TOOL_CHOICE,
          "none",
        ]);
        // the extra call isn't run
        expect(tmdbUrls(spy, "/3/search/movie")).toHaveLength(MAX_TOOL_ROUNDS);
        expect(results(LAST)).toEqual([
          {
            type: "function_result",
            call_id: `c${LAST}`,
            name: "search_titles",
            result: REFUSED,
            is_error: true,
          },
        ]);
        expect(events.slice(-3)).toEqual([
          ended(`c${LAST}`),
          { type: "delta", text: "Sorry." },
          { type: "done", interactionId: `i${LAST + 1}` },
        ]);
        expect(console.warn).toHaveBeenCalledWith(
          `Gemini round ${MAX_TOOL_ROUNDS} ignored tool_choice ${JSON.stringify(FINAL_ROUND_TOOL_CHOICE)}: search_titles`,
        );
      });

      test("show_recommendations with a lookup in the last round: neither runs, no cards", async () => {
        const spy = tmdb({ "/3/movie/228150": FURY_DETAILS });
        alwaysTools({
          [LAST]: toolRound(
            `i${LAST}`,
            showCall("c-show", 228150),
            searchCall("c-search"),
          ),
          [LAST + 1]: answerRound(`i${LAST + 1}`, "Sorry."),
        });

        const { events } = await readNdjson(await post({ content: "war" }));

        expect(tmdbUrls(spy, "/3/movie/228150")).toHaveLength(0);
        expect(tmdbUrls(spy, "/3/search/movie")).toHaveLength(MAX_TOOL_ROUNDS);
        expect(results(LAST)).toEqual([
          expect.objectContaining({ call_id: "c-show", is_error: true }),
          expect.objectContaining({ call_id: "c-search", is_error: true }),
        ]);
        expect(events.some((e) => e.type === "cards")).toBe(false);
        expect(events.at(-1)).toEqual({
          type: "done",
          interactionId: `i${LAST + 1}`,
        });
      });

      test("ignoring the tool choice twice ends with an error line", async () => {
        const spy = tmdb();
        alwaysTools();

        const { events } = await readNdjson(await post({ content: "war" }));

        expect(create).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS + 2);
        expect(tmdbUrls(spy, "/3/search/movie")).toHaveLength(MAX_TOOL_ROUNDS);
        expect(events.at(-1)).toEqual({ type: "error" });
        expect(events.some((e) => e.type === "done")).toBe(false);
        expect(console.error).toHaveBeenCalledWith(
          `Gemini round ${MAX_TOOL_ROUNDS + 1} ignored tool_choice "none": search_titles`,
        );
      });

      // seen with the real model: show_recommendations again after "none"
      test("calls after the cards despite tool_choice none aren't run, the cards stay", async () => {
        const spy = tmdb({ "/3/movie/228150": FURY_DETAILS });
        rounds(
          toolRound("i1", showCall("c-show", 228150)),
          toolRound("i2", showCall("c-again", 228150), searchCall("c-search")),
          answerRound("i3", "Enjoy."),
        );

        const { events } = await readNdjson(await post({ content: "war" }));

        expect(toolChoices()).toEqual(["auto", "none", "none"]);
        // only the first call looked the title up
        expect(tmdbUrls(spy, "/3/movie/228150")).toHaveLength(1);
        expect(tmdbUrls(spy, "/3/search/movie")).toHaveLength(0);
        expect(results(2)).toEqual([
          expect.objectContaining({ call_id: "c-again", result: REFUSED }),
          expect.objectContaining({ call_id: "c-search", result: REFUSED }),
        ]);
        expect(events.filter((e) => e.type === "cards")).toHaveLength(1);
        expect(events.slice(-4)).toEqual([
          ended("c-again"),
          ended("c-search"),
          { type: "delta", text: "Enjoy." },
          { type: "done", interactionId: "i3" },
        ]);
        expect(console.warn).toHaveBeenCalledWith(
          'Gemini round 1 ignored tool_choice "none": show_recommendations, search_titles',
        );
      });
    });

    describe("save_to_list", () => {
      const saving = (id: string) => ({
        type: "tool_start",
        id,
        name: "save_to_list",
        text: "Saving to your list...",
      });
      const saveCall = (id: string, args: object = {}): Call => ({
        id,
        name: "save_to_list",
        args: { type: "movie", id: 228150, title: "Fury", ...args },
      });
      const FURY_SAVED = {
        type: "movie",
        id: 228150,
        title: "Fury",
        posterPath: "/p.jpg",
        image: "/b.jpg",
        status: "Planning to watch",
      };
      const furyRow = (extra: object = {}) =>
        makeMovie({
          movieId: 228150,
          name: "Fury",
          image: "/b.jpg",
          status: "Planning to watch",
          ...extra,
        });

      let user: Awaited<ReturnType<typeof seedUser>>;
      beforeEach(async () => {
        user = await seedUser();
        tmdb({ "/3/movie/228150": FURY_DETAILS });
      });

      test("signed in: saves to the session user's list and streams list_saved after tool_end", async () => {
        asUser(user);
        rounds(toolRound("i1", saveCall("c1")), answerRound("i2", "Added."));

        const { events } = await readNdjson(
          await post({ content: "add Fury to my list" }),
        );

        expect(events).toEqual([
          { type: "start", interactionId: "i1" },
          saving("c1"),
          ended("c1"),
          { type: "list_saved", entry: FURY_SAVED, previous: null },
          { type: "delta", text: "Added." },
          { type: "done", interactionId: "i2" },
        ]);
        expect(results(1)).toEqual([
          {
            type: "function_result",
            call_id: "c1",
            name: "save_to_list",
            result: {
              saved: {
                id: 228150,
                type: "movie",
                title: "Fury",
                status: "Planning to watch",
              },
              previousStatus: null,
            },
          },
        ]);
        expect(await getMovies(user.id)).toEqual([furyRow({ rating: 0 })]);
        // a save isn't the cards: the model may still call tools
        expect(toolChoices()).toEqual(["auto", "auto"]);
      });

      test("already in the list: the status changes, the rating stays", async () => {
        asUser(user);
        await seedList(user.id, [furyRow({ status: "Watching", rating: 8 })]);
        rounds(
          toolRound("i1", saveCall("c1", { status: "Completed" })),
          answerRound("i2", "Done."),
        );

        const { events } = await readNdjson(
          await post({ content: "I finished Fury" }),
        );

        expect(events).toContainEqual({
          type: "list_saved",
          entry: { ...FURY_SAVED, status: "Completed" },
          previous: {
            name: "Fury",
            image: "/b.jpg",
            status: "Watching",
            rating: 8,
          },
        });
        expect(results(1)[0].result).toMatchObject({
          previousStatus: "Watching",
        });
        expect(await getMovies(user.id)).toEqual([
          furyRow({ status: "Completed", rating: 8 }),
        ]);
      });

      test("signed out: sign_in_required with TMDB's title, a non-error result, nothing written", async () => {
        rounds(
          toolRound("i1", saveCall("c1", { title: "FURY" })),
          answerRound("i2", "Sign in to save it."),
        );

        const { events } = await readNdjson(
          await post({ content: "add Fury to my list" }),
        );

        expect(events).toContainEqual({
          type: "sign_in_required",
          save: {
            type: "movie",
            id: 228150,
            title: "Fury",
            posterPath: "/p.jpg",
            status: null,
          },
        });
        expect(results(1)[0]).not.toHaveProperty("is_error");
        expect(results(1)[0].result).toMatchObject({ saved: false });
        expect(await getMovies(user.id)).toEqual([]);
      });

      test("an id TMDB doesn't know: an error result, nothing written", async () => {
        asUser(user);
        rounds(
          toolRound("i1", saveCall("c1", { id: 404 })),
          answerRound("i2", "."),
        );

        const { events } = await readNdjson(await post({ content: "add it" }));

        expect(results(1)).toEqual([
          {
            type: "function_result",
            call_id: "c1",
            name: "save_to_list",
            result: "not found on TMDB",
            is_error: true,
          },
        ]);
        expect(events.some((e) => e.type === "list_saved")).toBe(false);
        expect(await getMovies(user.id)).toEqual([]);
      });

      test("a status the list doesn't have is rejected before the handler runs", async () => {
        asUser(user);
        rounds(
          toolRound("i1", saveCall("c1", { status: "Dropped" })),
          answerRound("i2", "."),
        );

        await readNdjson(await post({ content: "drop Fury" }));

        expect(results(1)[0]).toMatchObject({
          is_error: true,
          result: expect.stringMatching(/^Invalid arguments: status: /),
        });
        expect(await getMovies(user.id)).toEqual([]);
      });

      test("a userId arg is rejected; only the session user's list is written", async () => {
        const victim = await seedUser();
        const victimList = [makeMovie({ movieId: 1, rating: 9 })];
        await seedList(victim.id, victimList);
        asUser(user);
        rounds(
          toolRound(
            "i1",
            saveCall("c1", { userId: victim.id }),
            saveCall("c2"),
          ),
          answerRound("i2", "."),
        );

        await readNdjson(await post({ content: "add Fury" }));

        expect(results(1)[0]).toEqual({
          type: "function_result",
          call_id: "c1",
          name: "save_to_list",
          result: 'Invalid arguments: Unrecognized key: "userId"',
          is_error: true,
        });
        expect(results(1)[1]).not.toHaveProperty("is_error");
        expect(await getMovies(victim.id)).toEqual(victimList);
        expect(await getMovies(user.id)).toEqual([furyRow({ rating: 0 })]);
      });

      test("the session can't be read: the chat goes on, the save is an error result without a TMDB request", async () => {
        const spy = tmdb();
        vi.mocked(auth as unknown as () => Promise<unknown>).mockRejectedValue(
          new Error("db down"),
        );
        rounds(toolRound("i1", saveCall("c1")), answerRound("i2", "Sorry."));

        const { events } = await readNdjson(await post({ content: "add it" }));

        expect(results(1)[0]).toMatchObject({
          result: "Can't save right now, try again later",
          is_error: true,
        });
        expect(spy).not.toHaveBeenCalled();
        expect(events.at(-1)).toEqual({ type: "done", interactionId: "i2" });
        expect(console.error).toHaveBeenCalledWith(
          "Couldn't read the session for the chat:",
          expect.objectContaining({ message: "db down" }),
        );
      });

      test("the session is read once per request", async () => {
        asUser(user);
        rounds(
          toolRound("i1", saveCall("c1")),
          toolRound("i2", saveCall("c2", { status: "Completed" })),
          answerRound("i3", "."),
        );

        await readNdjson(await post({ content: "add Fury" }));

        expect(auth).toHaveBeenCalledTimes(1);
        expect(await getMovies(user.id)).toEqual([
          furyRow({ status: "Completed", rating: 0 }),
        ]);
      });

      test("events follow the round's tool_ends in call order", async () => {
        asUser(user);
        tmdb({
          "/3/movie/228150": FURY_DETAILS,
          "/3/movie/550": rawDetails(550, { title: "Fight Club" }),
        });
        rounds(
          toolRound(
            "i1",
            saveCall("c1", { id: 550, title: "Fight Club" }),
            showCall("c2", 228150),
            saveCall("c3"),
          ),
          answerRound("i2", "."),
        );

        const { events } = await readNdjson(await post({ content: "x" }));

        expect(
          events
            .filter((e) => e.type !== "delta")
            .map((e) =>
              e.type === "list_saved" ? `${e.type} ${e.entry.id}` : e.type,
            ),
        ).toEqual([
          "start",
          "tool_start",
          "tool_start",
          "tool_start",
          "tool_end",
          "tool_end",
          "tool_end",
          "list_saved 550",
          "cards",
          "list_saved 228150",
          "done",
        ]);
        // the cards are shown: the model only writes text now
        expect(toolChoices()).toEqual(["auto", "none"]);
      });
    });

    describe("the user's list", () => {
      const listCall = (id: string): Call => ({
        id,
        name: "get_my_list",
        args: {},
      });
      const reading = (id: string) => ({
        type: "tool_start",
        id,
        name: "get_my_list",
        text: "Reading your list...",
      });
      // a search item for rawMovie(id, { title })
      const item = (id: number, title: string, extra: object = {}) => ({
        id,
        type: "movie",
        title,
        year: 2014,
        rating: 7.5,
        votes: 1234,
        genres: ["War", "Drama"],
        ...extra,
      });

      test("based on my list: the ordered list, recommendations for its top title with listed ones marked, then the cards", async () => {
        const user = await seedUser();
        await seedList(user.id, [
          makeMovie({
            movieId: 1,
            name: "Planned",
            status: "Planning to watch",
          }),
          makeMovie({ movieId: 228150, name: "Fury", rating: 9 }),
          makeMovie({ movieId: 2, name: "Meh", rating: 3 }),
          makeMovie({ movieId: 550, name: "Fight Club" }),
        ]);
        asUser(user);
        tmdb({
          "/3/movie/228150/recommendations": page([
            rawMovie(550, { title: "Fight Club" }),
            rawMovie(10),
          ]),
          "/3/movie/10": rawDetails(10),
        });
        rounds(
          toolRound("i1", listCall("c1")),
          toolRound("i2", {
            id: "c2",
            name: "get_recommendations",
            args: { type: "movie", id: 228150 },
          }),
          toolRound("i3", showCall("c3", 10)),
          answerRound("i4", "Like Fury."),
        );

        const { events } = await readNdjson(
          await post({ content: "recommend something based on my list" }),
        );

        expect(results(1)).toEqual([
          {
            type: "function_result",
            call_id: "c1",
            name: "get_my_list",
            result: {
              total: 4,
              omitted: 0,
              titles: [
                {
                  type: "movie",
                  id: 228150,
                  title: "Fury",
                  status: "Completed",
                  rating: 9,
                },
                {
                  type: "movie",
                  id: 2,
                  title: "Meh",
                  status: "Completed",
                  rating: 3,
                },
                {
                  type: "movie",
                  id: 550,
                  title: "Fight Club",
                  status: "Completed",
                  rating: null,
                },
                {
                  type: "movie",
                  id: 1,
                  title: "Planned",
                  status: "Planning to watch",
                  rating: null,
                },
              ],
            },
          },
        ]);
        expect(results(2)).toEqual([
          {
            type: "function_result",
            call_id: "c2",
            name: "get_recommendations",
            result: {
              results: [
                item(550, "Fight Club", { inList: "Completed" }),
                item(10, "Movie 10"),
              ],
            },
          },
        ]);
        expect(events).toEqual([
          { type: "start", interactionId: "i1" },
          reading("c1"),
          ended("c1"),
          {
            type: "tool_start",
            id: "c2",
            name: "get_recommendations",
            text: "Finding recommendations...",
          },
          ended("c2"),
          preparing("c3"),
          ended("c3"),
          {
            type: "cards",
            items: [
              {
                type: "movie",
                id: 10,
                title: "Movie 10",
                year: 2014,
                rating: 7.5,
                genres: ["War", "Drama"],
                posterPath: "/p.jpg",
                backdropPath: "/b.jpg",
                reason: "Reason 10.",
              },
            ],
          },
          { type: "delta", text: "Like Fury." },
          { type: "done", interactionId: "i4" },
        ]);
        expect(toolChoices()).toEqual(["auto", "auto", "auto", "none"]);
      });

      test("signed out: a non-error result and no sign_in_required", async () => {
        tmdb();
        rounds(
          toolRound("i1", listCall("c1")),
          answerRound("i2", "Sign in to use your list."),
        );

        const { events } = await readNdjson(
          await post({ content: "recommend something based on my list" }),
        );

        expect(results(1)).toEqual([
          {
            type: "function_result",
            call_id: "c1",
            name: "get_my_list",
            result: {
              signedIn: false,
              reason: "The user isn't signed in, so their list can't be read.",
            },
          },
        ]);
        expect(events).toEqual([
          { type: "start", interactionId: "i1" },
          reading("c1"),
          ended("c1"),
          { type: "delta", text: "Sign in to use your list." },
          { type: "done", interactionId: "i2" },
        ]);
      });

      test("a save in the turn is seen by the next read of the list", async () => {
        const user = await seedUser();
        asUser(user);
        tmdb({ "/3/movie/228150": FURY_DETAILS });
        rounds(
          toolRound("i1", listCall("c1")),
          toolRound("i2", {
            id: "c2",
            name: "save_to_list",
            args: { type: "movie", id: 228150, title: "Fury" },
          }),
          toolRound("i3", listCall("c3")),
          answerRound("i4", "."),
        );

        await readNdjson(await post({ content: "add Fury, then my list" }));

        expect(results(1)[0].result).toEqual({
          total: 0,
          omitted: 0,
          titles: [],
        });
        expect(results(3)[0].result).toEqual({
          total: 1,
          omitted: 0,
          titles: [
            {
              type: "movie",
              id: 228150,
              title: "Fury",
              status: "Planning to watch",
              rating: null,
            },
          ],
        });
      });
    });

    test("invalid calls get is_error results and the loop goes on", async () => {
      const spy = tmdb();
      rounds(
        [
          created("i1"),
          functionCall(1, { id: "c1", name: "search_titles" }),
          argsDelta(1, '{"query":'),
          stepStop(1),
          ...toolCall(2, {
            id: "c2",
            name: "search_titles",
            args: { query: "Fury", type: "film" },
          }),
          ...toolCall(3, { id: "c3", name: "get_weather", args: {} }),
          requiresAction("i1"),
        ],
        answerRound("i2", "Sorry."),
      );

      const { events } = await readNdjson(await post({ content: "war" }));

      expect(results(1)).toEqual([
        {
          type: "function_result",
          call_id: "c1",
          name: "search_titles",
          result: "Arguments are not valid JSON",
          is_error: true,
        },
        {
          type: "function_result",
          call_id: "c2",
          name: "search_titles",
          result:
            'Invalid arguments: type: Invalid option: expected one of "movie"|"tv"',
          is_error: true,
        },
        {
          type: "function_result",
          call_id: "c3",
          name: "get_weather",
          result: "Unknown tool: get_weather",
          is_error: true,
        },
      ]);
      expect(spy).not.toHaveBeenCalled();
      // rejected calls start and end like the others
      expect(events.filter((e) => e.type.startsWith("tool_"))).toEqual([
        searching("c1"),
        searching("c2"),
        {
          type: "tool_start",
          id: "c3",
          name: "get_weather",
          text: "Checking TMDB database...",
        },
        ended("c1"),
        ended("c2"),
        ended("c3"),
      ]);
      expect(events.at(-1)).toEqual({ type: "done", interactionId: "i2" });
      expect(events).not.toContainEqual({ type: "error" });
    });

    test("a failed TMDB request becomes an is_error result and the turn completes", async () => {
      tmdb({ "/3/search/movie": new Response("down", { status: 500 }) });
      rounds(toolRound("i1", searchCall("c1")), answerRound("i2", "Sorry."));

      const { events } = await readNdjson(await post({ content: "war" }));

      expect(results(1)).toEqual([
        {
          type: "function_result",
          call_id: "c1",
          name: "search_titles",
          result: "TMDB request failed (status 500)",
          is_error: true,
        },
      ]);
      expect(events.at(-1)).toEqual({ type: "done", interactionId: "i2" });
    });

    test("a TMDB request that hangs times out after 8 s", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const spy = tmdb({ "/3/search/movie": hangUntilAborted });
      rounds(toolRound("i1", searchCall("c1")), answerRound("i2", "Sorry."));

      const reading = readNdjson(await post({ content: "war" }));
      await vi.advanceTimersByTimeAsync(7999);
      expect(create).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      const { events } = await reading;

      expect(results(1)).toEqual([
        expect.objectContaining({
          call_id: "c1",
          result: "TMDB request timed out",
          is_error: true,
        }),
      ]);
      const searchInit = spy.mock.calls.find(([url]) =>
        String(url).includes("/search/movie"),
      )?.[1];
      expect(searchInit?.signal?.aborted).toBe(true);
      expect(events.at(-1)).toEqual({ type: "done", interactionId: "i2" });
    });

    test("too many calls: 10 run, the 11th gets is_error, all 11 get results", async () => {
      const spy = tmdb();
      const calls = Array.from({ length: 11 }, (_, i) =>
        searchCall(`c${i + 1}`, `Title ${i + 1}`),
      );
      rounds(toolRound("i1", ...calls), answerRound("i2", "Done."));

      const { events } = await readNdjson(await post({ content: "war" }));

      expect(tmdbUrls(spy, "/3/search/movie")).toHaveLength(10);
      // the call over the limit ends too
      expect(events.filter((e) => e.type === "tool_end")).toEqual(
        calls.map((c) => ended(c.id)),
      );
      const input = results(1);
      expect(input.map((r: { call_id: string }) => r.call_id)).toEqual(
        calls.map((c) => c.id),
      );
      expect(input.filter((r: { is_error?: boolean }) => r.is_error)).toEqual([
        {
          type: "function_result",
          call_id: "c11",
          name: "search_titles",
          result: "Too many calls in one round (max 10)",
          is_error: true,
        },
      ]);
    });

    describe("stop during a tool round", () => {
      test("cancelling the response aborts TMDB and sends no further request", async () => {
        const spy = tmdb({ "/3/search/movie": hangUntilAborted });
        rounds(toolRound("i1", searchCall("c1")), answerRound("i2", "late"));
        const reader = (await post({ content: "war" })).body!.getReader();
        expect(await readLine(reader)).toEqual({
          type: "start",
          interactionId: "i1",
        });
        expect(await readLine(reader)).toEqual(searching("c1"));
        await vi.waitFor(() =>
          expect(tmdbUrls(spy, "/3/search/movie")).toHaveLength(1),
        );

        await reader.cancel();
        await flush();

        const searchInit = spy.mock.calls.find(([url]) =>
          String(url).includes("/search/movie"),
        )?.[1];
        expect(searchInit?.signal?.aborted).toBe(true);
        expect(create).toHaveBeenCalledTimes(1);
        expect(console.error).not.toHaveBeenCalled();
        expect(console.info).not.toHaveBeenCalledWith(
          expect.stringMatching(/^Tool round/),
        );
      });

      test("an aborted request ends the stream with no error line or log", async () => {
        const spy = tmdb({ "/3/search/movie": hangUntilAborted });
        rounds(toolRound("i1", searchCall("c1")), answerRound("i2", "late"));
        const client = new AbortController();
        const res = await POST(
          new Request(
            jsonRequest("POST", "/api/assistant", { content: "war" }),
            {
              signal: client.signal,
            },
          ) as NextRequest,
        );
        const reader = res.body!.getReader();
        await readLine(reader); // start
        expect(await readLine(reader)).toEqual(searching("c1"));
        await vi.waitFor(() =>
          expect(tmdbUrls(spy, "/3/search/movie")).toHaveLength(1),
        );

        client.abort();

        // the stream closes without a tool_end or an error line
        expect((await reader.read()).done).toBe(true);
        expect(create).toHaveBeenCalledTimes(1);
        expect(console.error).not.toHaveBeenCalled();
      });
    });

    describe("text around tool rounds", () => {
      test("is sent as it is, the client separates it from the tool lines", async () => {
        tmdb();
        rounds(
          [
            created("i1"),
            textDelta("Let me check."),
            ...toolCall(1, searchCall("c1")),
            requiresAction("i1"),
          ],
          answerRound("i2", "Here", " you go."),
        );

        const { events } = await readNdjson(await post({ content: "war" }));

        expect(events).toEqual([
          { type: "start", interactionId: "i1" },
          { type: "delta", text: "Let me check." },
          searching("c1"),
          ended("c1"),
          { type: "delta", text: "Here" },
          { type: "delta", text: " you go." },
          { type: "done", interactionId: "i2" },
        ]);
      });

      test("a round without text in between: each call starts and ends in its round", async () => {
        tmdb();
        rounds(
          [
            created("i1"),
            textDelta("Let me check."),
            ...toolCall(1, searchCall("c1")),
            requiresAction("i1"),
          ],
          toolRound("i2", searchCall("c2")),
          answerRound("i3", "Here"),
        );

        const { events } = await readNdjson(await post({ content: "war" }));

        expect(events.slice(1)).toEqual([
          { type: "delta", text: "Let me check." },
          searching("c1"),
          ended("c1"),
          searching("c2"),
          ended("c2"),
          { type: "delta", text: "Here" },
          { type: "done", interactionId: "i3" },
        ]);
      });
    });

    describe("bad endings", () => {
      test("requires_action without calls ends with an error line", async () => {
        rounds([created("i1"), requiresAction("i1")]);

        const { events } = await readNdjson(await post({ content: "war" }));

        expect(events).toEqual([
          { type: "start", interactionId: "i1" },
          { type: "error" },
        ]);
        expect(create).toHaveBeenCalledTimes(1);
      });

      test("create failing in a later round sends an error line, not a 502", async () => {
        tmdb();
        const quota = new Error("quota");
        create
          .mockResolvedValueOnce(
            geminiEvents(toolRound("i1", searchCall("c1"))),
          )
          .mockRejectedValueOnce(quota);

        const res = await post({ content: "war" });
        const { events } = await readNdjson(res);

        expect(res.status).toBe(200);
        expect(events).toEqual([
          { type: "start", interactionId: "i1" },
          searching("c1"),
          ended("c1"),
          { type: "error" },
        ]);
        expect(console.error).toHaveBeenCalledWith(
          "Gemini stream error:",
          quota,
        );
      });

      it.each([
        ["a failed status", [created("i2"), completed("i2", "failed")]],
        ["no interaction.completed", [created("i2"), textDelta("cut")]],
      ])("%s after a tool round ends with an error line", async (_, last) => {
        tmdb();
        rounds(toolRound("i1", searchCall("c1")), last);

        const { events } = await readNdjson(await post({ content: "war" }));

        expect(events.at(-1)).toEqual({ type: "error" });
        expect(events.some((e) => e.type === "done")).toBe(false);
      });
    });
  });
});
