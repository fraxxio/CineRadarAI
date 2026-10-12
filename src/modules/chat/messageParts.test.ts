import { describe, expect, it, test } from "vitest";
import {
  addCards,
  appendText,
  endTool,
  formatElapsed,
  isWaitingForModel,
  partsToText,
  startTool,
  stopTools,
} from "./messageParts";
import type { MessagePart, RecommendedTitle, ToolPart } from "./protocol";

const SEARCH = { name: "search_titles", text: "Searching TMDB database..." };
const DETAILS = { name: "get_title_details", text: "Checking title details..." };

const call = (id: string, tool = SEARCH) => ({ id, ...tool });
const text = (value: string): MessagePart => ({ type: "text", text: value });
const card = (
  id: number,
  title: string,
  year: number | null,
  type: RecommendedTitle["type"] = "movie",
): RecommendedTitle => ({
  type,
  id,
  title,
  year,
  rating: 7.5,
  genres: ["War"],
  posterPath: "/p.jpg",
  backdropPath: "/b.jpg",
  reason: "Because.",
});
const FURY = card(228150, "Fury", 2014);
const DUNKIRK = card(374720, "Dunkirk", 2017);
const tools = (parts: MessagePart[]) =>
  parts.filter((part): part is ToolPart => part.type === "tool");
// [name, number of calls] per part, "text" for text parts
const shape = (parts: MessagePart[]) =>
  parts.map((part) =>
    part.type === "tool" ? [part.name, part.callIds.length] : part.type,
  );

describe("appendText", () => {
  test("adds to the last text part", () => {
    expect(appendText([text("Let me ")], "check.")).toEqual([
      text("Let me check."),
    ]);
  });

  test("starts a new text part after a tool part", () => {
    const parts = appendText(startTool([], call("c1"), 0), "Here");
    expect(shape(parts)).toEqual([["search_titles", 1], "text"]);
    expect(parts[1]).toEqual(text("Here"));
  });

  test("doesn't change its input", () => {
    const parts = [text("a")];
    appendText(parts, "b");
    expect(parts).toEqual([text("a")]);
  });
});

describe("addCards", () => {
  test("appends a cards part after the others", () => {
    const parts = addCards(startTool([text("Intro.")], call("c1"), 0), [FURY]);
    expect(shape(parts)).toEqual(["text", ["search_titles", 1], "cards"]);
    expect(parts[2]).toEqual({ type: "cards", items: [FURY] });
  });

  test("two results make two parts", () => {
    const parts = addCards(addCards([], [FURY]), [DUNKIRK]);
    expect(parts).toEqual([
      { type: "cards", items: [FURY] },
      { type: "cards", items: [DUNKIRK] },
    ]);
  });

  test("doesn't change its input", () => {
    const parts = [text("a")];
    addCards(parts, [FURY]);
    expect(parts).toEqual([text("a")]);
  });
});

describe("startTool", () => {
  test("a new line runs from now", () => {
    expect(startTool([], call("c1"), 100)).toEqual([
      {
        type: "tool",
        name: "search_titles",
        label: "Searching TMDB database...",
        callIds: ["c1"],
        runningIds: ["c1"],
        elapsedMs: 0,
        runningSince: 100,
      },
    ]);
  });

  test("A, A: one line with two calls", () => {
    let parts = startTool([], call("c1"), 0);
    parts = startTool(parts, call("c2"), 0);
    expect(shape(parts)).toEqual([["search_titles", 2]]);
    expect(tools(parts)[0].runningIds).toEqual(["c1", "c2"]);
  });

  test("A, B: two lines", () => {
    let parts = startTool([], call("c1"), 0);
    parts = startTool(parts, call("c2", DETAILS), 0);
    expect(shape(parts)).toEqual([
      ["search_titles", 1],
      ["get_title_details", 1],
    ]);
    expect(tools(parts)[1].label).toBe("Checking title details...");
  });

  test("A, B, A: A has two calls, B one, in that order", () => {
    let parts = startTool([], call("c1"), 0);
    parts = startTool(parts, call("c2", DETAILS), 0);
    parts = startTool(parts, call("c3"), 0);
    expect(shape(parts)).toEqual([
      ["search_titles", 2],
      ["get_title_details", 1],
    ]);
  });

  test("A, text, A: text starts a new block", () => {
    let parts = startTool([], call("c1"), 0);
    parts = appendText(parts, "Let me check more.");
    parts = startTool(parts, call("c2"), 0);
    expect(shape(parts)).toEqual([
      ["search_titles", 1],
      "text",
      ["search_titles", 1],
    ]);
  });

  test("A, cards, A: cards start a new block", () => {
    let parts = startTool([], call("c1"), 0);
    parts = endTool(parts, "c1", 1000);
    parts = addCards(parts, [FURY]);
    parts = startTool(parts, call("c2"), 2000);
    expect(shape(parts)).toEqual([
      ["search_titles", 1],
      "cards",
      ["search_titles", 1],
    ]);
  });

  test("a later round with no text in between merges into the same line", () => {
    let parts = startTool([text("Let me check.")], call("c1"), 0);
    parts = endTool(parts, "c1", 1000);
    parts = startTool(parts, call("c2"), 3000);
    expect(shape(parts)).toEqual(["text", ["search_titles", 2]]);
    expect(tools(parts)[0].runningSince).toBe(3000);
  });

  test("a merged call keeps the running stretch's start", () => {
    let parts = startTool([], call("c1"), 0);
    parts = startTool(parts, call("c2"), 500);
    expect(tools(parts)[0].runningSince).toBe(0);
  });

  test("doesn't change its input", () => {
    const parts = startTool([], call("c1"), 0);
    const before = structuredClone(parts);
    startTool(parts, call("c2"), 0);
    expect(parts).toEqual(before);
  });
});

describe("endTool", () => {
  test("counts active time only, not the gap between calls", () => {
    let parts = startTool([], call("c1"), 0);
    parts = endTool(parts, "c1", 1000);
    expect(tools(parts)[0]).toMatchObject({
      elapsedMs: 1000,
      runningIds: [],
      runningSince: undefined,
    });

    parts = startTool(parts, call("c2"), 5000);
    parts = endTool(parts, "c2", 5500);
    expect(tools(parts)[0]).toMatchObject({
      elapsedMs: 1500,
      callIds: ["c1", "c2"],
      runningIds: [],
      runningSince: undefined,
    });
  });

  test("a line with two calls runs until both have ended", () => {
    let parts = startTool([], call("c1"), 0);
    parts = startTool(parts, call("c2"), 0);

    parts = endTool(parts, "c1", 1000);
    expect(tools(parts)[0]).toMatchObject({
      runningIds: ["c2"],
      runningSince: 0,
      elapsedMs: 0,
    });

    parts = endTool(parts, "c2", 2000);
    expect(tools(parts)[0]).toMatchObject({
      runningIds: [],
      runningSince: undefined,
      elapsedMs: 2000,
    });
  });

  test("ends only the line that has the call", () => {
    let parts = startTool([], call("c1"), 0);
    parts = startTool(parts, call("c2", DETAILS), 0);
    parts = endTool(parts, "c2", 1000);
    expect(tools(parts).map((part) => part.runningIds)).toEqual([["c1"], []]);
  });

  test("an unknown id returns the parts unchanged", () => {
    const parts = startTool([], call("c1"), 0);
    expect(endTool(parts, "nope", 1000)).toBe(parts);
  });

  test("an id that already ended changes nothing", () => {
    const parts = endTool(startTool([], call("c1"), 0), "c1", 1000);
    expect(endTool(parts, "c1", 9000)).toBe(parts);
  });
});

describe("stopTools", () => {
  test("freezes running lines at now and leaves finished ones alone", () => {
    let parts = startTool([], call("c1"), 0);
    parts = endTool(parts, "c1", 1000);
    parts = appendText(parts, "More.");
    parts = startTool(parts, call("c2", DETAILS), 2000);
    parts = startTool(parts, call("c3", DETAILS), 2000);

    const stopped = stopTools(parts, 2500);

    expect(stopped[0]).toBe(parts[0]);
    expect(stopped[2]).toEqual({
      ...parts[2],
      runningIds: [],
      runningSince: undefined,
      elapsedMs: 500,
    });
  });
});

describe("partsToText", () => {
  test("joins text parts with a blank line and skips tools", () => {
    let parts = appendText([], "Let me check.");
    parts = startTool(parts, call("c1"), 0);
    parts = appendText(parts, "Here you go.");
    expect(partsToText(parts)).toBe("Let me check.\n\nHere you go.");
  });

  test("cards become one bracketed note, in order with the text", () => {
    let parts = appendText([], "Intro.");
    parts = startTool(parts, call("c1"), 0);
    parts = addCards(parts, [FURY, DUNKIRK]);
    parts = appendText(parts, "Want more?");
    expect(partsToText(parts)).toBe(
      "Intro.\n\n" +
        "[Shown as cards: 1. Fury (movie 228150, 2014); 2. Dunkirk (movie 374720, 2017)]" +
        "\n\nWant more?",
    );
  });

  test("a card without a year and a TV card", () => {
    const parts = addCards(
      [],
      [card(1399, "Game of Thrones", 2011, "tv"), card(5, "Untitled", null)],
    );
    expect(partsToText(parts)).toBe(
      "[Shown as cards: 1. Game of Thrones (tv 1399, 2011); 2. Untitled (movie 5, unknown year)]",
    );
  });

  test("no text: empty", () => {
    expect(partsToText(startTool([], call("c1"), 0))).toBe("");
    expect(partsToText([])).toBe("");
  });
});

describe("isWaitingForModel", () => {
  const running = startTool([], call("c1"), 0);
  const finished = endTool(running, "c1", 1);

  it.each<[string, MessagePart[], boolean]>([
    ["nothing yet", [], true],
    ["a running tool", running, false],
    ["a finished tool", finished, true],
    ["cards", addCards(finished, [FURY]), true],
    ["text", appendText(finished, "x"), false],
    ["text after cards", appendText(addCards(finished, [FURY]), "x"), false],
  ])("%s -> %s", (_, parts, expected) => {
    expect(isWaitingForModel(parts)).toBe(expected);
  });
});

describe("formatElapsed", () => {
  it.each([
    [0, "0.0s"],
    [99, "0.0s"],
    [2400, "2.4s"],
    [2499, "2.4s"],
    // rounds down: never "10.0s"
    [9950, "9.9s"],
    [9999, "9.9s"],
    [10_000, "10s"],
    [14_000, "14s"],
    [59_999, "59s"],
    [60_000, "1m 00s"],
    [65_000, "1m 05s"],
    [754_000, "12m 34s"],
    // clock went backwards
    [-5, "0.0s"],
  ])("%d ms -> %s", (ms, shown) => {
    expect(formatElapsed(ms)).toBe(shown);
  });
});
