import { beforeEach, describe, expect, test, vi } from "vitest";
import type { EntryKey } from "@/modules/my-list";
import { makeMovie } from "@test/helpers/factories";
import {
  completed,
  created,
  geminiEvents,
  requiresAction,
  textDelta,
  toolCall,
} from "../testing/stream";
import type { ToolCall, ToolContext, ToolResult } from "../tools/types";
import { streamChatReply } from "./llmService";

const { create, readEntries, runToolCalls } = vi.hoisted(() => ({
  create: vi.fn(),
  readEntries: vi.fn(),
  runToolCalls: vi.fn(),
}));
vi.mock("@google/genai", () => ({
  // `function`, not arrow: llmService calls `new GoogleGenAI(...)`
  GoogleGenAI: vi.fn(function () {
    return { interactions: { create } };
  }),
}));
vi.mock("@/modules/my-list/server", () => ({ readEntries }));
// the tools' list reads are what's under test, not the tools
vi.mock("../tools/registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../tools/registry")>()),
  runToolCalls,
}));

const user = { status: "signed_in", id: "u1" } as const;

// DB reads done by the end of each tool round
let readsByRound: number[];

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  create.mockReset();
  readEntries.mockReset().mockResolvedValue([makeMovie({ movieId: 228150 })]);
  readsByRound = [];
  // every call of a round reads the list, like the lookups do, and
  // save_to_list resets it, like the tool does after a save
  runToolCalls.mockImplementation(
    async (calls: ToolCall[], ctx: ToolContext): Promise<ToolResult[]> => {
      await Promise.all(calls.map(() => ctx.list()));
      if (calls.some((call) => call.name === "save_to_list")) {
        ctx.invalidateList();
      }
      readsByRound.push(readEntries.mock.calls.length);
      return calls.map((call) => ({
        callId: call.id,
        name: call.name,
        output: {},
        isError: false,
      }));
    },
  );
});

const toolRound = (id: string, ...names: string[]) => [
  created(id),
  ...names.flatMap((name, i) =>
    toolCall(i + 1, { id: `${id}-c${i}`, name, args: {} }),
  ),
  requiresAction(id),
];
const answerRound = (id: string) => [
  created(id),
  textDelta("Done."),
  completed(id),
];

// one interactions.create result per round, then the turn runs to the end
async function turn(rounds: object[][], listChanges: EntryKey[] = []) {
  for (const round of rounds) {
    create.mockResolvedValueOnce(geminiEvents(round));
  }
  const events = await streamChatReply({
    prompt: "hi",
    stoppedTurns: [],
    signal: new AbortController().signal,
    user,
    listChanges,
  });
  for await (const _ of events) {
    // drain
  }
}

describe("the turn's list", () => {
  test("the list-change note and the tools share one read", async () => {
    await turn(
      [
        toolRound("i1", "search_titles", "get_trending"),
        toolRound("i2", "get_similar"),
        answerRound("i3"),
      ],
      [{ movieId: 228150, type: "movie" }],
    );
    expect(create.mock.calls[0][0].input).toContainEqual({
      type: "user_input",
      content: [
        {
          type: "text",
          text: "[List update: Fury (movie 228150) is Completed]",
        },
      ],
    });
    expect(readsByRound).toEqual([1, 1]);
  });

  test("a tool that resets the list: the next round reads again", async () => {
    await turn([
      toolRound("i1", "search_titles"),
      toolRound("i2", "save_to_list", "search_titles"),
      toolRound("i3", "get_similar"),
      answerRound("i4"),
    ]);
    expect(readsByRound).toEqual([1, 1, 2]);
  });
});
