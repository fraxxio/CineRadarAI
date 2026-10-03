import { describe, expect, test, vi } from "vitest";
import { buildSystemInstruction } from "./chatConfig";
import { movieFilterSchema } from "@/modules/search";

describe("buildSystemInstruction", () => {
  test("includes the given date as YYYY-MM-DD (UTC)", () => {
    expect(buildSystemInstruction(new Date("2026-03-04T12:00:00Z"))).toContain(
      "Today's date is 2026-03-04.",
    );
  });

  test("contains the link formats the app relies on", () => {
    const prompt = buildSystemInstruction();
    expect(prompt).toContain("(/search?query=Title&btn=movie&year=YYYY)");
    expect(prompt).toContain("(/search?query=Title&btn=tv)");
  });

  // catches prompt edits that would produce links the search page can't parse
  test("every example link matches the search page's contract", () => {
    const links = [
      ...buildSystemInstruction().matchAll(/\((\/search\?[^)\s]+)\)/g),
    ].map((m) => m[1]);
    expect(links.length).toBeGreaterThanOrEqual(4);

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
