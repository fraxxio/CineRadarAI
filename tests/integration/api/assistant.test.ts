import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "@/app/api/assistant/route";
import { CHAT_MODEL, buildSystemInstruction } from "@/lib/chatConfig";
import { MAX_PROMPT_LENGTH } from "@/lib/chatLimits";
import { jsonRequest } from "../../helpers/requests";
import { geminiEvents, readNdjson } from "../../helpers/stream";

const { create, ctor } = vi.hoisted(() => ({ create: vi.fn(), ctor: vi.fn() }));
vi.mock("@google/genai", () => ({
  // `function`, not arrow: the route calls `new GoogleGenAI(...)` (Vitest 4)
  GoogleGenAI: vi.fn(function (opts: unknown) {
    ctor(opts);
    return { interactions: { create } };
  }),
}));

beforeEach(() => {
  vi.stubEnv("AI_CHAT_ENABLED", "true");
  create.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

const post = (body: unknown) =>
  POST(jsonRequest("POST", "/api/assistant", body) as NextRequest);

const created = (id = "i1") => ({
  event_type: "interaction.created",
  interaction: { id },
});
const textDelta = (text: string) => ({
  event_type: "step.delta",
  delta: { type: "text", text },
});
const completed = (id = "i1", status = "completed") => ({
  event_type: "interaction.completed",
  interaction: { id, status },
});

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
    );
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
    );
  });

  test("returns 502 when interactions.create throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    create.mockRejectedValue(new Error("quota"));
    const res = await post({ content: "hi" });
    expect(res.status).toBe(502);
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

  test.fails("[B11] returns 400 for a malformed JSON body", async () => {
    const res = await POST(
      jsonRequest("POST", "/api/assistant", "{not json") as NextRequest,
    );
    expect(res.status).toBe(400);
  });
});
