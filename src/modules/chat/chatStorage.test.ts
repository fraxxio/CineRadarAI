import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";
import {
  MAX_SAVED_CHAT_AGE_MS,
  clearSavedChat,
  loadChat,
  saveChat,
  type ChatSnapshot,
} from "./chatStorage";
import type { RecommendedTitle } from "./protocol";

const KEY = "cineradar.chat.v1";

const FURY: RecommendedTitle = {
  type: "movie",
  id: 228150,
  title: "Fury",
  year: 2014,
  rating: 7.5,
  genres: ["War"],
  posterPath: "/fury.jpg",
  backdropPath: null,
  reason: "A tense WWII drama.",
};

const CHAT: ChatSnapshot = {
  messages: [
    { id: "m1", role: "user", parts: [{ type: "text", text: "war films" }] },
    {
      id: "m2",
      role: "assistant",
      parts: [
        {
          type: "tool",
          name: "search_titles",
          label: "Searching TMDB database...",
          callIds: ["c1"],
          runningIds: [],
          elapsedMs: 1200,
        },
        { type: "text", text: "Here you go." },
        { type: "cards", items: [FURY] },
      ],
    },
    { id: "m3", role: "user", parts: [{ type: "text", text: "more" }] },
    {
      id: "m4",
      role: "assistant",
      parts: [{ type: "text", text: "Sure" }],
      stopped: true,
    },
  ],
  interactionId: "i1",
  stoppedTurns: [{ prompt: "more", partialText: "Sure" }],
};

let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
});

const stored = () => JSON.parse(storage.get(KEY)!);
const store = (value: unknown) => storage.set(KEY, JSON.stringify(value));

describe("chatStorage", () => {
  test("round trip", () => {
    saveChat(CHAT);
    expect(loadChat()).toEqual({
      ...CHAT,
      version: 1,
      savedAt: expect.any(Number),
    });
  });

  test("without an interaction id", () => {
    saveChat({ ...CHAT, interactionId: undefined });
    expect(loadChat()).not.toHaveProperty("interactionId");
  });

  test("nothing saved", () => {
    expect(loadChat()).toBeNull();
  });

  test("clearSavedChat removes it", () => {
    saveChat(CHAT);
    clearSavedChat();
    expect(storage.has(KEY)).toBe(false);
    expect(loadChat()).toBeNull();
  });

  test(`keeps a chat saved up to ${MAX_SAVED_CHAT_AGE_MS / 3_600_000} hours ago`, () => {
    vi.useFakeTimers();
    saveChat(CHAT);
    vi.advanceTimersByTime(MAX_SAVED_CHAT_AGE_MS);
    expect(loadChat()).not.toBeNull();
  });

  describe("returns null and removes the key", () => {
    // the saved blob with some fields changed
    const savedWith = (change: Record<string, unknown>) => {
      saveChat(CHAT);
      return { ...stored(), ...change };
    };
    const withMessage = (change: (message: any) => void) => {
      const chat = savedWith({});
      change(chat.messages[0]);
      return chat;
    };
    const withPart = (part: unknown) =>
      withMessage((message) => message.parts.push(part));
    const withCard = (change: Record<string, unknown>) =>
      withPart({ type: "cards", items: [{ ...FURY, ...change }] });

    test("too old", () => {
      vi.useFakeTimers();
      saveChat(CHAT);
      vi.advanceTimersByTime(MAX_SAVED_CHAT_AGE_MS + 1);
      expect(loadChat()).toBeNull();
      expect(storage.has(KEY)).toBe(false);
    });

    test("broken JSON", () => {
      storage.set(KEY, '{"version":1,');
      expect(loadChat()).toBeNull();
      expect(storage.has(KEY)).toBe(false);
    });

    it.each([
      ["another version", () => savedWith({ version: 2 })],
      ["not an object", () => [CHAT]],
      ["null", () => null],
      ["no savedAt", () => savedWith({ savedAt: "now" })],
      ["no messages", () => savedWith({ messages: {} })],
      ["no stopped turns", () => savedWith({ stoppedTurns: undefined })],
      [
        "a bad stopped turn",
        () => savedWith({ stoppedTurns: [{ prompt: 1 }] }),
      ],
      ["a numeric interaction id", () => savedWith({ interactionId: 1 })],
      ["an unknown role", () => withMessage((m) => (m.role = "system"))],
      ["a message without an id", () => withMessage((m) => delete m.id)],
      ["an unknown part type", () => withPart({ type: "video", url: "x" })],
      ["a part without a type", () => withPart({ text: "hi" })],
      ["a text part without text", () => withPart({ type: "text" })],
      [
        "a running tool line",
        () =>
          withPart({
            type: "tool",
            name: "search_titles",
            label: "Searching...",
            callIds: ["c1"],
            runningIds: ["c1"],
            elapsedMs: 0,
            runningSince: 1,
          }),
      ],
      ["a card without genres", () => withCard({ genres: undefined })],
      ["a card with a string id", () => withCard({ id: "228150" })],
      ["a card of an unknown type", () => withCard({ type: "person" })],
    ])("%s", (_, chat) => {
      store(chat());
      expect(loadChat()).toBeNull();
      expect(storage.has(KEY)).toBe(false);
    });
  });

  describe("storage failures don't throw", () => {
    const failing = () => {
      throw new DOMException("blocked", "SecurityError");
    };

    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    test("every method throwing", () => {
      vi.stubGlobal("window", {
        sessionStorage: {
          getItem: failing,
          setItem: failing,
          removeItem: failing,
        },
      });

      expect(() => saveChat(CHAT)).not.toThrow();
      expect(loadChat()).toBeNull();
      expect(() => clearSavedChat()).not.toThrow();
      expect(console.warn).toHaveBeenCalledTimes(3);
    });

    test("removing a bad blob throwing", () => {
      vi.stubGlobal("window", {
        sessionStorage: { getItem: () => "{", removeItem: failing },
      });

      expect(loadChat()).toBeNull();
    });

    test("sessionStorage itself throwing (blocked)", () => {
      vi.stubGlobal("window", {
        get sessionStorage() {
          return failing();
        },
      });

      expect(() => saveChat(CHAT)).not.toThrow();
      expect(loadChat()).toBeNull();
      expect(() => clearSavedChat()).not.toThrow();
    });
  });
});
