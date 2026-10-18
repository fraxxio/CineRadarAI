import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import MyListItems from "./MyListItems";
import type { StoredEntry } from "../entry";
import { makeMovie } from "@test/helpers/factories";

const list = (entries: StoredEntry[]) => Promise.resolve(entries);

describe("MyListItems", () => {
  // the store already sorted them
  test("renders the entries in the given order", async () => {
    const entries = list([
      makeMovie({ movieId: 1, name: "Low", rating: 2 }),
      makeMovie({ movieId: 2, name: "High", rating: 9 }),
    ]);

    render(await MyListItems({ entries, page: 1 }));

    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual([
      "Low",
      "High",
    ]);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
  });

  test("numbering continues on later pages", async () => {
    const entries = list([
      makeMovie({ movieId: 1, name: "A" }),
      makeMovie({ movieId: 2, name: "B" }),
    ]);

    render(await MyListItems({ entries, page: 2 }));

    expect(screen.getByText("#25")).toBeInTheDocument();
    expect(screen.getByText("#26")).toBeInTheDocument();
  });

  test("[B4] a movie and a TV show with the same id both render", async () => {
    const error = vi.spyOn(console, "error");
    const entries = list([
      makeMovie({ movieId: 550, type: "movie", name: "Film" }),
      makeMovie({ movieId: 550, type: "tv", name: "Show" }),
    ]);

    render(await MyListItems({ entries, page: 1 }));

    expect(screen.getByRole("link", { name: "Film" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show" })).toBeInTheDocument();
    // React reports duplicate keys through console.error
    expect(error).not.toHaveBeenCalled();
  });
});
