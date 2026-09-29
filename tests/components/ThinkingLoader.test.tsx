import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ThinkingLoader } from "@/Components/ui/ThinkingLoader";

// single-character words, so getByText matches the per-letter span
const WORDS = ["A", "B", "C"];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const shown = () =>
  WORDS.filter((w) => screen.queryByText(w, { exact: true }) !== null);

describe("ThinkingLoader", () => {
  test("starts at startIndex, wrapped to the word list", () => {
    render(<ThinkingLoader words={WORDS} startIndex={4} />);
    expect(shown()).toEqual(["B"]);
    expect(screen.getByRole("status")).toHaveTextContent("Generating response");
  });

  test("rotates every 4 s and wraps around", () => {
    render(<ThinkingLoader words={WORDS} startIndex={4} />);

    act(() => vi.advanceTimersByTime(3999));
    expect(shown()).toEqual(["B"]);
    act(() => vi.advanceTimersByTime(1));
    expect(shown()).toEqual(["C"]);
    act(() => vi.advanceTimersByTime(4000));
    expect(shown()).toEqual(["A"]);
  });

  test("clears its interval on unmount", () => {
    const { unmount } = render(<ThinkingLoader words={WORDS} startIndex={0} />);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  test("splits a word into one span per letter", () => {
    const { container } = render(
      <ThinkingLoader words={["Hi there"]} startIndex={0} />,
    );
    const letters = container.querySelectorAll("span[aria-hidden] > span");
    expect(letters).toHaveLength(8);
    expect(letters[2].textContent).toBe(" "); // space -> nbsp keeps the gap
  });
});
