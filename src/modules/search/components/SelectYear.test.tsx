import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SelectYear } from "./SelectYear";

afterEach(() => vi.useRealTimers());

describe("SelectYear", () => {
  test("from the current year down to 1888", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-15"));
    render(<SelectYear />);

    const select = screen.getByRole("combobox");
    const [placeholder, ...years] = Array.from(
      select.querySelectorAll("option"),
    ).map((o) => o.value);

    expect(select).toHaveAttribute("name", "year");
    expect(placeholder).toBe("");
    expect(years).toHaveLength(139);
    expect(years[0]).toBe("2026");
    expect(years.at(-1)).toBe("1888");
  });

  test("passes props through", () => {
    render(<SelectYear defaultValue="2014" />);
    expect(screen.getByRole("combobox")).toHaveValue("2014");
  });
});
