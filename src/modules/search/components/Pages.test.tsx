import { render, screen } from "@testing-library/react";
import { describe, expect, it, test } from "vitest";
import { Pages } from "./Pages";

const fv = {
  query: "Fury",
  language: "fr",
  year: "2014",
  adult: true,
  btn: "movie",
};
const fvParams = {
  query: "Fury",
  language: "fr",
  year: "2014",
  adult: "true",
  btn: "movie",
};

const renderPages = (page: string | undefined, totalPages: number) =>
  render(
    <Pages
      page={page}
      totalPages={totalPages}
      totalResults={totalPages * 20}
      filterValues={fv}
    />,
  );

const NAV = ["Previous", "Next"];
const label = (b: HTMLElement) => b.textContent!.trim();
// page-number buttons in DOM order (Previous/Next excluded)
const numbers = () =>
  screen
    .getAllByRole("button")
    .map(label)
    .filter((l) => !NAV.includes(l))
    .map(Number);
const hrefOf = (button: HTMLElement) =>
  button.closest("a")!.getAttribute("href")!;
const params = (href: string) =>
  Object.fromEntries(new URL(href, "http://x").searchParams);

describe("Pages", () => {
  test("page 1: Previous disabled, no previous-page buttons", () => {
    renderPages("1", 50);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    expect(numbers()).toEqual([1, 2, 3, 4, 5, 50]);
  });

  test("defaults to page 1 when page is undefined", () => {
    renderPages(undefined, 50);
    expect(screen.getByRole("button", { name: "1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  test("middle page: 4 buttons on each side, current highlighted and disabled", () => {
    renderPages("10", 50);
    expect(numbers()).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 50]);

    const current = screen.getByRole("button", { name: "10" });
    expect(current).toBeDisabled();
    expect(current).toHaveClass("bg-primary-text");
    expect(screen.getByRole("button", { name: "9" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });

  test("[B5] last page: Next disabled, no buttons past the end", () => {
    renderPages("3", 3);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(numbers().filter((n) => n > 3)).toEqual([]);
  });

  test("[B5] page 2 of 3: no button for page 4", () => {
    renderPages("2", 3);
    expect(screen.queryByRole("button", { name: "4" })).toBeNull();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it.each([
    ["1", 3, [1, 2, 3]],
    ["2", 3, [1, 2, 3]],
    ["3", 3, [1, 2, 3]],
    ["46", 50, [42, 43, 44, 45, 46, 47, 48, 49, 50]],
    ["45", 50, [41, 42, 43, 44, 45, 46, 47, 48, 49, 50]],
    ["500", 800, [496, 497, 498, 499, 500]],
  ])(
    "page %s of %i: every page once, no ... when the last is in reach",
    (page, total, expected) => {
      renderPages(page, total);
      expect(numbers()).toEqual(expected);
      expect(screen.queryByText("...")).toBeNull();
    },
  );

  test("the ... and last page appear when the last is out of reach", () => {
    renderPages("44", 50);
    expect(numbers()).toEqual([40, 41, 42, 43, 44, 45, 46, 47, 48, 50]);
    expect(screen.getByText("...")).toBeInTheDocument();
  });

  test("caps total pages at 500", () => {
    renderPages("1", 800);
    const summary = screen.getByText("Page:").closest("p")!;
    expect(summary.textContent!.replace(/\s+/g, " ")).toBe("Page: 1 / 500");
    expect(numbers().at(-1)).toBe(500);
    expect(screen.queryByRole("button", { name: "800" })).toBeNull();
  });

  test("single page: both navigation buttons disabled", () => {
    renderPages("1", 1);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  test("every link keeps the filters and points at its own page", () => {
    renderPages("10", 50);

    for (const button of screen.getAllByRole("button")) {
      const name = label(button);
      const page = name === "Previous" ? "9" : name === "Next" ? "11" : name;
      expect(params(hrefOf(button)), name).toEqual({ ...fvParams, page });
    }
  });
});
