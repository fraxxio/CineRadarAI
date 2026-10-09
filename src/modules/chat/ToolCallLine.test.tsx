import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ToolPart } from "./protocol";
import { ToolCallLine } from "./ToolCallLine";

const LABEL = "Searching TMDB database...";

const part = (overrides: Partial<ToolPart> = {}): ToolPart => ({
  type: "tool",
  name: "search_titles",
  label: LABEL,
  callIds: ["c1"],
  runningIds: [],
  elapsedMs: 0,
  ...overrides,
});
const running = (overrides: Partial<ToolPart> = {}) =>
  part({ runningIds: ["c1"], runningSince: Date.now(), ...overrides });

const line = () => screen.getByText(LABEL, { exact: false });
const spinner = (container: HTMLElement) =>
  container.querySelector("svg.animate-spin");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
});
afterEach(() => vi.useRealTimers());

describe("ToolCallLine", () => {
  test("a running line: status role, spinner, label and a live time", () => {
    const { container } = render(<ToolCallLine part={running()} />);

    expect(screen.getByRole("status")).toHaveTextContent(LABEL);
    expect(spinner(container)).toBeInTheDocument();
    expect(line()).toHaveTextContent(`${LABEL} - 0.0s`);

    act(() => vi.advanceTimersByTime(2400));
    expect(line()).toHaveTextContent(`${LABEL} - 2.4s`);
    act(() => vi.advanceTimersByTime(12_000));
    expect(line()).toHaveTextContent(`${LABEL} - 14s`);
  });

  test("time of earlier stretches adds to the running one", () => {
    render(<ToolCallLine part={running({ elapsedMs: 1500 })} />);
    act(() => vi.advanceTimersByTime(1000));
    expect(line()).toHaveTextContent("2.5s");
  });

  test("a finished line: no status role, no spinner, a frozen time", () => {
    const { container } = render(
      <ToolCallLine part={part({ elapsedMs: 65_000 })} />,
    );

    expect(screen.queryByRole("status")).toBeNull();
    expect(spinner(container)).toBeNull();
    expect(line()).toHaveTextContent(`${LABEL} - 1m 05s`);
    expect(vi.getTimerCount()).toBe(0);

    act(() => vi.advanceTimersByTime(5000));
    expect(line()).toHaveTextContent("1m 05s");
  });

  test("ending the line stops its timer at the time it had", () => {
    const { container, rerender } = render(<ToolCallLine part={running()} />);
    act(() => vi.advanceTimersByTime(3000));

    rerender(<ToolCallLine part={part({ elapsedMs: 3000 })} />);
    act(() => vi.advanceTimersByTime(5000));

    expect(line()).toHaveTextContent("3.0s");
    expect(spinner(container)).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  test("clears its timer on unmount", () => {
    const { unmount } = render(<ToolCallLine part={running()} />);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  test("the counter shows only for more than one call", () => {
    const { rerender } = render(<ToolCallLine part={part()} />);
    expect(line()).not.toHaveTextContent("(1x)");
    expect(line()).not.toHaveTextContent(/\(\d+x\)/);

    rerender(<ToolCallLine part={part({ callIds: ["c1", "c2", "c3"] })} />);
    expect(line()).toHaveTextContent(`${LABEL} (3x) - 0.0s`);
  });

  test("the time is hidden from screen readers", () => {
    render(<ToolCallLine part={running()} />);
    const time = screen.getByText("0.0s");
    expect(time).toHaveAttribute("aria-hidden", "true");
  });
});
