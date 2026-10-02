import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import MyListItems, { ListLength } from "./MyListItems";
import { getEntries } from "../store";
import type { ListView } from "../view";
import { getSession } from "@/infra/auth/session";
import { makeMovie, makeSession } from "@test/helpers/factories";

vi.mock("../store", () => ({ getEntries: vi.fn() }));

const view: ListView = { type: "both", status: "all", rating: "desc" };
const session = makeSession();

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue(session as any);
});

describe("MyListItems", () => {
  test("reads the session user's list in view order", async () => {
    vi.mocked(getEntries).mockResolvedValue([
      makeMovie({ movieId: 1, name: "Low", rating: 2 }),
      makeMovie({ movieId: 2, name: "High", rating: 9 }),
    ]);

    render(await MyListItems(view));

    expect(getEntries).toHaveBeenCalledWith(session.user.id);
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual([
      "High",
      "Low",
    ]);
  });

  test("an empty list", async () => {
    vi.mocked(getEntries).mockResolvedValue([]);
    render(await MyListItems(view));
    expect(screen.getByText("Your list is empty.")).toBeInTheDocument();
  });

  test("[B4] a movie and a TV show with the same id both render", async () => {
    const error = vi.spyOn(console, "error");
    vi.mocked(getEntries).mockResolvedValue([
      makeMovie({ movieId: 550, type: "movie", name: "Film" }),
      makeMovie({ movieId: 550, type: "tv", name: "Show" }),
    ]);

    render(await MyListItems(view));

    expect(screen.getByRole("link", { name: "Film" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show" })).toBeInTheDocument();
    // React reports duplicate keys through console.error
    expect(error).not.toHaveBeenCalled();
  });
});

describe("ListLength", () => {
  test("counts the entries left by the view", async () => {
    vi.mocked(getEntries).mockResolvedValue([
      makeMovie({ movieId: 1, type: "movie" }),
      makeMovie({ movieId: 2, type: "tv" }),
    ]);

    render(await ListLength({ ...view, type: "tv" }));

    expect(screen.getByText("Length: 1")).toBeInTheDocument();
  });
});
