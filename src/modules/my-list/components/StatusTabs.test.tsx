import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import StatusTabs from "./StatusTabs";
import { DEFAULT_VIEW, type ListCounts, type ListView } from "../view";

const counts = (changes: Partial<ListCounts> = {}): ListCounts => ({
  all: 6,
  watching: 1,
  planning: 2,
  completed: 3,
  other: 0,
  ...changes,
});

const renderTabs = (view: Partial<ListView>, tabCounts = counts()) =>
  render(<StatusTabs view={{ ...DEFAULT_VIEW, ...view }} counts={tabCounts} />);

const tabs = () =>
  within(screen.getByRole("navigation", { name: "Status" })).getAllByRole(
    "link",
  );

describe("StatusTabs", () => {
  test("each tab shows its count, in order", () => {
    renderTabs({});
    expect(tabs().map((tab) => tab.textContent)).toEqual([
      "All 6",
      "Watching 1",
      "Planning to watch 2",
      "Completed 3",
    ]);
  });

  test("marks the active tab", () => {
    renderTabs({ status: "planning" });
    expect(
      screen.getByRole("link", { name: "Planning to watch 2" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "All 6" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  test("Other is hidden at 0", () => {
    renderTabs({});
    expect(screen.queryByRole("link", { name: /^Other/ })).toBeNull();
  });

  test("Other shows when legacy rows exist", () => {
    renderTabs({}, counts({ other: 2 }));
    expect(screen.getByRole("link", { name: "Other 2" })).toHaveAttribute(
      "href",
      "/my-list?status=other",
    );
  });

  // e.g. ?status=other&type=tv when the legacy rows are all movies
  test("an open Other tab stays at 0", () => {
    renderTabs({ status: "other" });
    expect(screen.getByRole("link", { name: "Other 0" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("hrefs keep the type and sort but reset the page", () => {
    renderTabs({ status: "completed", type: "tv", sort: "recent", page: 3 });
    expect(screen.getByRole("link", { name: "Watching 1" })).toHaveAttribute(
      "href",
      "/my-list?status=watching&type=tv&sort=recent",
    );
    expect(screen.getByRole("link", { name: "All 6" })).toHaveAttribute(
      "href",
      "/my-list?type=tv&sort=recent",
    );
  });
});
