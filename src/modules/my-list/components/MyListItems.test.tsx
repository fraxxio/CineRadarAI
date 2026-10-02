import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import MyListItems, { ListLength } from "./MyListItems";
import type { ListEntry } from "../entry";
import type { ListView } from "../view";
import { makeMovie } from "@test/helpers/factories";

const view: ListView = { type: "both", status: "all", rating: "desc" };
const list = (entries: ListEntry[]) => Promise.resolve(entries);

describe("MyListItems", () => {
  test("renders the entries in view order", async () => {
    const entries = list([
      makeMovie({ movieId: 1, name: "Low", rating: 2 }),
      makeMovie({ movieId: 2, name: "High", rating: 9 }),
    ]);

    render(await MyListItems({ entries, view }));

    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual([
      "High",
      "Low",
    ]);
  });

  test("an empty list", async () => {
    render(await MyListItems({ entries: list([]), view }));
    expect(screen.getByText("Your list is empty.")).toBeInTheDocument();
  });

  test("[B4] a movie and a TV show with the same id both render", async () => {
    const error = vi.spyOn(console, "error");
    const entries = list([
      makeMovie({ movieId: 550, type: "movie", name: "Film" }),
      makeMovie({ movieId: 550, type: "tv", name: "Show" }),
    ]);

    render(await MyListItems({ entries, view }));

    expect(screen.getByRole("link", { name: "Film" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show" })).toBeInTheDocument();
    // React reports duplicate keys through console.error
    expect(error).not.toHaveBeenCalled();
  });
});

describe("ListLength", () => {
  test("counts the entries left by the view", async () => {
    const entries = list([
      makeMovie({ movieId: 1, type: "movie" }),
      makeMovie({ movieId: 2, type: "tv" }),
    ]);

    render(await ListLength({ entries, view: { ...view, type: "tv" } }));

    expect(screen.getByText("Length: 1")).toBeInTheDocument();
  });
});
