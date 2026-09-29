import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import Details from "@/Components/Details";
import AddToListBtn from "@/Components/ui/AddToListBtn";
import { getSession } from "@/lib/session";
import { makeSession } from "../helpers/factories";
import { mockTmdb, tmdbFixture } from "../helpers/tmdb";

vi.mock("@/Components/ui/AddToListBtn", () => ({ default: vi.fn(() => null) }));

const movie = tmdbFixture("movie-550");
const tv = tmdbFixture("tv-1399");

const renderMovie = async (overrides: object = {}) => {
  const spy = mockTmdb({ "/3/movie/550": { ...movie, ...overrides } });
  render(await Details({ id: 550, mediaType: "movie" }));
  return spy;
};
const renderTv = async () => {
  mockTmdb({ "/3/tv/1399": tv });
  render(await Details({ id: 1399, mediaType: "tv" }));
};

// "Label: <b>value</b>" -> the <p> holding the label
const field = (label: string) => screen.getByText(label).closest("p")!;

beforeEach(() => vi.mocked(getSession).mockReset());

describe("Details", () => {
  test("requests the details in English", async () => {
    const spy = await renderMovie();
    const url = new URL(String(spy.mock.lastCall![0]));
    expect(url.pathname).toBe("/3/movie/550");
    expect(url.searchParams.get("language")).toBe("en-US");
  });

  test("movie: title, duration, budget and revenue", async () => {
    await renderMovie();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Fight Club",
    );
    expect(field("Duration:")).toHaveTextContent("Duration: 139 min.");
    expect(field("Budget:")).toHaveTextContent("Budget: $63.0M");
    expect(field("Revenue:")).toHaveTextContent("Revenue: $100.9M");
    expect(screen.queryByText(/Seasons:/)).toBeNull();
    expect(screen.getByText("Released: 1999-10-15")).toBeInTheDocument();
  });

  test("TV: name, seasons, first air date and show type", async () => {
    await renderTv();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Game of Thrones",
    );
    expect(field("Seasons:")).toHaveTextContent("Seasons: 8");
    expect(field("First air date:")).toHaveTextContent(
      "First air date: 2011-04-17",
    );
    expect(field("Show type:")).toHaveTextContent("Show type: Scripted");
    expect(screen.queryByText(/Budget:/)).toBeNull();
    expect(screen.queryByText(/Duration:/)).toBeNull();
    expect(screen.getByText("Ended: 2019-05-19")).toBeInTheDocument();
  });

  test("poster, falling back to the backdrop", async () => {
    await renderMovie({ poster_path: null });
    expect(screen.getByAltText("Fight Club")).toHaveAttribute(
      "src",
      `https://image.tmdb.org/t/p/w500${movie.backdrop_path}`,
    );
  });

  test("no poster and no backdrop -> No poster.", async () => {
    await renderMovie({ poster_path: null, backdrop_path: null });
    expect(screen.getByText("No poster.")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Fight Club" })).toBeNull();
  });

  test("every genre is shown", async () => {
    await renderMovie();
    expect(screen.getByText("Drama")).toBeInTheDocument();
    expect(screen.getByText("Thriller")).toBeInTheDocument();
  });

  test("rating with one decimal and the vote count", async () => {
    await renderMovie({ vote_average: 8.438, vote_count: 27000 });
    expect(screen.getByText("8.4 / 27000")).toBeInTheDocument();
  });

  test("links to TMDB's where-to-watch page and the page sections", async () => {
    await renderMovie();
    expect(
      screen.getByRole("link", { name: "Where to watch?" }),
    ).toHaveAttribute("href", "https://www.themoviedb.org/movie/550/watch");
    for (const section of ["Trailer", "Gallery", "Reviews"]) {
      expect(screen.getByRole("link", { name: section })).toHaveAttribute(
        "href",
        `#${section.toLowerCase()}`,
      );
    }
  });

  test("passes the session user and the entry to AddToListBtn", async () => {
    const session = makeSession();
    vi.mocked(getSession).mockResolvedValue(session as any);
    await renderMovie();

    expect(vi.mocked(AddToListBtn).mock.lastCall![0]).toEqual({
      user: session.user,
      movieId: 550,
      title: "Fight Club",
      image: movie.backdrop_path,
      type: "movie",
      fullSize: true,
    });
  });

  test("logged out -> AddToListBtn gets no user; TV uses the name", async () => {
    await renderTv();
    expect(vi.mocked(AddToListBtn).mock.lastCall![0]).toMatchObject({
      user: undefined,
      title: "Game of Thrones",
      type: "tv",
    });
  });

  test("a TMDB error rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockTmdb({ "/3/movie/550": new Response("x", { status: 500 }) });
    await expect(Details({ id: 550, mediaType: "movie" })).rejects.toThrow(
      "Failed to fetch movie details (Status: 500)",
    );
  });
});
