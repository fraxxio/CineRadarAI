import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import ListShelves, { type ShelfEntries } from "./ListShelves";
import { DEFAULT_VIEW, type ListCounts, type ListView } from "../view";
import { makeMovie } from "@test/helpers/factories";

const counts = (changes: Partial<ListCounts> = {}): ListCounts => ({
  all: 0,
  watching: 0,
  planning: 0,
  completed: 0,
  other: 0,
  ...changes,
});

const titles = (prefix: string, length: number) =>
  Array.from({ length }, (_, i) =>
    makeMovie({ movieId: i + 1, name: `${prefix}${i + 1}`, image: "/p.jpg" }),
  );

const renderShelves = async (
  shelfCounts: ListCounts,
  shelves: ShelfEntries,
  view: Partial<ListView> = {},
) =>
  render(
    await ListShelves({
      view: { ...DEFAULT_VIEW, ...view },
      counts: shelfCounts,
      shelves: Promise.resolve(shelves),
    }),
  );

const headings = () =>
  screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

describe("ListShelves", () => {
  test("a shelf per status, in tab order, each heading with its count", async () => {
    // the entries' key order doesn't decide the shelf order
    await renderShelves(
      counts({ all: 4, watching: 1, planning: 1, completed: 1, other: 1 }),
      {
        other: titles("O", 1),
        completed: titles("C", 1),
        planning: titles("P", 1),
        watching: titles("W", 1),
      },
    );

    expect(headings()).toEqual([
      "Watching 1",
      "Planning to watch 1",
      "Completed 1",
      "Other 1",
    ]);
  });

  test("each shelf is a region with its rows in a list", async () => {
    await renderShelves(counts({ all: 3, watching: 2, completed: 1 }), {
      watching: titles("W", 2),
      completed: titles("C", 1),
    });

    const shelf = screen.getByRole("region", { name: "Watching 2" });
    const rows = within(
      within(shelf).getByRole("list", { name: "Watching 2" }),
    ).getAllByRole("listitem");
    expect(
      rows.map((row) => within(row).getByRole("link").textContent),
    ).toEqual(["W1", "W2"]);
    expect(
      within(screen.getByRole("region", { name: "Completed 1" })).getByRole(
        "link",
      ),
    ).toHaveTextContent("C1");
  });

  test("empty statuses have no shelf", async () => {
    await renderShelves(counts({ all: 1, completed: 1 }), {
      completed: titles("C", 1),
    });

    expect(headings()).toEqual(["Completed 1"]);
    expect(screen.queryByRole("region", { name: /^Watching/ })).toBeNull();
    expect(screen.queryByRole("region", { name: /^Other/ })).toBeNull();
  });

  // its titles moved between the counts and the shelf reads
  test("a shelf read empty is hidden", async () => {
    await renderShelves(counts({ all: 2, watching: 1, completed: 1 }), {
      watching: [],
      completed: titles("C", 1),
    });

    expect(headings()).toEqual(["Completed 1"]);
  });

  test("See all only when the status has more than SHELF_SIZE titles", async () => {
    await renderShelves(counts({ all: 13, watching: 6, completed: 7 }), {
      watching: titles("W", 6),
      completed: titles("C", 6),
    });

    expect(
      within(screen.getByRole("region", { name: "Watching 6" })).queryByRole(
        "link",
        { name: /^See all/ },
      ),
    ).toBeNull();
    expect(
      within(screen.getByRole("region", { name: "Completed 7" })).getByRole(
        "link",
        { name: "See all (7)" },
      ),
    ).toHaveAttribute("href", "/my-list?status=completed");
  });

  test("See all keeps the type and sort", async () => {
    await renderShelves(
      counts({ all: 9, planning: 9 }),
      { planning: titles("P", 6) },
      { type: "tv", sort: "recent" },
    );

    expect(screen.getByRole("link", { name: "See all (9)" })).toHaveAttribute(
      "href",
      "/my-list?status=planning&type=tv&sort=recent",
    );
  });

  test("only the first three thumbnails overall load eagerly", async () => {
    await renderShelves(counts({ all: 4, watching: 2, completed: 2 }), {
      watching: titles("W", 2),
      completed: titles("C", 2),
    });

    expect(
      screen.getAllByRole("img").map((img) => img.getAttribute("loading")),
    ).toEqual([null, null, null, "lazy"]);
  });

  test("[B4] a movie and a TV show with the same id both render", async () => {
    await renderShelves(counts({ all: 2, watching: 2 }), {
      watching: [
        makeMovie({ movieId: 550, type: "movie", name: "Film" }),
        makeMovie({ movieId: 550, type: "tv", name: "Show" }),
      ],
    });

    expect(screen.getByRole("link", { name: "Film" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show" })).toBeInTheDocument();
  });
});
