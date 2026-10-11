import { afterEach, describe, expect, it, vi } from "vitest";
import { today } from "./date";

afterEach(() => {
  vi.useRealTimers();
});

describe("today", () => {
  it.each([
    ["2026-10-08T00:00:00Z", "2026-10-08"],
    ["2026-10-08T23:59:59.999Z", "2026-10-08"],
    // just after midnight in UTC+3 is still the day before in UTC
    ["2026-10-09T01:30:00+03:00", "2026-10-08"],
  ])("%s -> %s", (now, date) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(now));
    expect(today()).toBe(date);
  });

  it("formats the given date", () => {
    expect(today(new Date("2026-03-04T12:00:00Z"))).toBe("2026-03-04");
  });
});
