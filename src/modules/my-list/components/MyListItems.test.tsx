import { render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import MyListItems from "./MyListItems";
import type { StoredEntry } from "../entry";
import { makeMovie } from "@test/helpers/factories";

const list = (entries: StoredEntry[]) => Promise.resolve(entries);

describe("MyListItems", () => {
  // the store already sorted them
  test("renders the entries as list items in the given order", async () => {
    const entries = list([
      makeMovie({ movieId: 1, name: "Low", rating: 2 }),
      makeMovie({ movieId: 2, name: "High", rating: 9 }),
    ]);

    render(await MyListItems({ entries }));

    const rows = within(
      screen.getByRole("list", { name: "Titles" }),
    ).getAllByRole("listitem");
    expect(
      rows.map((row) => within(row).getByRole("link").textContent),
    ).toEqual(["Low", "High"]);
  });

  test("only the first three thumbnails load eagerly", async () => {
    const entries = list(
      Array.from({ length: 5 }, (_, i) =>
        makeMovie({ movieId: i + 1, name: `T${i + 1}`, image: "/p.jpg" }),
      ),
    );

    render(await MyListItems({ entries }));

    expect(
      screen.getAllByRole("img").map((img) => img.getAttribute("loading")),
    ).toEqual([null, null, null, "lazy", "lazy"]);
  });

  test("[B4] a movie and a TV show with the same id both render", async () => {
    const error = vi.spyOn(console, "error");
    const entries = list([
      makeMovie({ movieId: 550, type: "movie", name: "Film" }),
      makeMovie({ movieId: 550, type: "tv", name: "Show" }),
    ]);

    render(await MyListItems({ entries }));

    expect(screen.getByRole("link", { name: "Film" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show" })).toBeInTheDocument();
    // React reports duplicate keys through console.error
    expect(error).not.toHaveBeenCalled();
  });
});
