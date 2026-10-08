import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ThinkingLoader } from "./ThinkingLoader";

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

  describe("fixed text", () => {
    // no capital A, B or C: shown() looks for those single letters
    const STATUS = "Searching the movie database...";

    test("replaces the rotating words and the screen-reader text", () => {
      render(<ThinkingLoader words={WORDS} startIndex={0} text={STATUS} />);

      expect(shown()).toEqual([]);
      const status = screen.getByRole("status");
      expect(status.querySelector(".sr-only")).toHaveTextContent(STATUS);
      expect(status).not.toHaveTextContent("Generating response");
      // one bouncing letter per character
      expect(status.querySelectorAll("span[aria-hidden] > span")).toHaveLength(
        STATUS.length,
      );
    });

    test("stays put while the words would rotate", () => {
      render(<ThinkingLoader words={WORDS} startIndex={0} text={STATUS} />);
      act(() => vi.advanceTimersByTime(8000));
      expect(shown()).toEqual([]);
      expect(screen.getByRole("status")).toHaveTextContent(STATUS);
    });

    test("without words: no rotation timer", () => {
      render(<ThinkingLoader text={STATUS} />);
      expect(vi.getTimerCount()).toBe(0);
      expect(screen.getByRole("status")).toHaveTextContent(STATUS);
    });

    test("an empty text falls back to the words", () => {
      render(<ThinkingLoader words={WORDS} startIndex={1} text="" />);
      expect(shown()).toEqual(["B"]);
      expect(screen.getByRole("status")).toHaveTextContent(
        "Generating response",
      );
    });

    test("a new text restarts the animation", () => {
      const { container, rerender } = render(
        <ThinkingLoader text="Searching" />,
      );
      const before = container.querySelector("span[aria-hidden]");

      rerender(<ThinkingLoader text="Checking" />);

      const after = container.querySelector("span[aria-hidden]");
      expect(after).toHaveTextContent("Checking");
      // keyed by the text: a new element, so the CSS animation starts over
      expect(after).not.toBe(before);
    });
  });
});
