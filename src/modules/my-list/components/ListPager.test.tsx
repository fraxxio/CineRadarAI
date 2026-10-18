import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, test } from "vitest";
import ListPager, { pagerItems } from "./ListPager";
import { DEFAULT_VIEW, PAGE_SIZE, type ListView } from "../view";

// only status tabs are paginated; the "All" tab shows shelves
const tabView: ListView = { ...DEFAULT_VIEW, status: "completed" };

const renderPager = (changes: Partial<ListView>, pages: number) =>
  render(
    <ListPager view={{ ...tabView, ...changes }} total={pages * PAGE_SIZE} />,
  );

const pagination = () => screen.getByRole("navigation", { name: "Pagination" });
const pageLinks = () =>
  within(pagination())
    .getAllByRole("link", { name: /^Page / })
    .map((link) => link.textContent);

describe("pagerItems", () => {
  it.each([
    [1, 1, [1]],
    [1, 3, [1, 2, 3]],
    [1, 10, [1, 2, "gap", 10]],
    [5, 10, [1, "gap", 4, 5, 6, "gap", 10]],
    [3, 10, [1, 2, 3, 4, "gap", 10]],
    [10, 10, [1, "gap", 9, 10]],
    [4, 5, [1, "gap", 3, 4, 5]],
  ])("page %i of %i -> %j", (current, pages, items) => {
    expect(pagerItems(current, pages)).toEqual(items);
  });
});

describe("ListPager", () => {
  test("hidden with one page", () => {
    const { container } = render(
      <ListPager view={tabView} total={PAGE_SIZE} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("hidden for an empty view", () => {
    const { container } = render(<ListPager view={tabView} total={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("shows with one row over a page", () => {
    render(<ListPager view={tabView} total={PAGE_SIZE + 1} />);
    expect(pageLinks()).toEqual(["1", "2"]);
  });

  test("marks the current page", () => {
    renderPager({ page: 2 }, 3);
    expect(screen.getByRole("link", { name: "Page 2" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Page 1" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  test("the page links keep the filters", () => {
    renderPager({ status: "watching", sort: "recent", page: 2 }, 3);
    expect(screen.getByRole("link", { name: "Page 1" })).toHaveAttribute(
      "href",
      "/my-list?status=watching&sort=recent",
    );
    expect(screen.getByRole("link", { name: "Page 3" })).toHaveAttribute(
      "href",
      "/my-list?status=watching&sort=recent&page=3",
    );
  });

  test("previous and next link to the neighbouring pages", () => {
    renderPager({ page: 2 }, 3);
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "/my-list?status=completed",
    );
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/my-list?status=completed&page=3",
    );
  });

  test("no previous link on the first page", () => {
    renderPager({ page: 1 }, 3);
    expect(screen.queryByRole("link", { name: "Previous" })).toBeNull();
    expect(screen.getByText("Previous")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  test("no next link on the last page", () => {
    renderPager({ page: 3 }, 3);
    expect(screen.queryByRole("link", { name: "Next" })).toBeNull();
    expect(screen.getByText("Next")).toHaveAttribute("aria-disabled", "true");
  });

  test("skips far pages with an ellipsis", () => {
    renderPager({ page: 5 }, 10);
    expect(pageLinks()).toEqual(["1", "4", "5", "6", "10"]);
    expect(within(pagination()).getAllByText("…")).toHaveLength(2);
  });
});
