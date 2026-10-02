import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import MovieCard from "@/Components/ui/MovieCard";
import { getSession } from "@/infra/auth/session";
import { makeSession } from "../helpers/factories";

// AddToListBtn stays real (client component)

type CardMovie = Parameters<typeof MovieCard>[0]["movie"];

const makeResult = (overrides: Partial<CardMovie> = {}) =>
  ({
    adult: false,
    backdrop_path: "/b.jpg",
    genre_ids: [18],
    id: 550,
    original_language: "en",
    original_title: "Fight Club",
    overview: "",
    popularity: 1,
    poster_path: "/p.jpg",
    release_date: "1999-10-15",
    title: "Fight Club",
    video: false,
    vote_average: 8.4,
    vote_count: 30000,
    ...overrides,
  }) as CardMovie;

const renderCard = async (
  overrides: Partial<CardMovie> = {},
  type: "movie" | "tv" = "movie",
) => render(await MovieCard({ movie: makeResult(overrides), type }));

beforeEach(() => vi.mocked(getSession).mockReset());

describe("MovieCard", () => {
  test("links to the details page of its type", async () => {
    await renderCard(
      {
        id: 7,
        title: undefined,
        name: "Show",
        release_date: undefined,
        first_air_date: "2011-04-17",
      },
      "tv",
    );
    const link = screen.getByRole("heading", { name: "Show" }).closest("a");
    expect(link).toHaveAttribute("href", "/search/tv/7");
    expect(screen.getByText("2011-04-17")).toBeInTheDocument();
  });

  test("poster, falling back to the backdrop", async () => {
    await renderCard({ poster_path: null as any });
    expect(screen.getByAltText("Fight Club")).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w500/b.jpg",
    );
  });

  test("no poster and no backdrop -> No Image", async () => {
    await renderCard({ poster_path: null as any, backdrop_path: null as any });
    expect(screen.getByText("No Image")).toBeInTheDocument();
    expect(screen.queryByAltText("Fight Club")).toBeNull();
  });

  test("title falls back to name", async () => {
    await renderCard({ title: undefined, name: "Show" }, "tv");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Show");
    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute(
      "title",
      "Show",
    );
  });

  test("rating with one decimal and the vote count", async () => {
    await renderCard({ vote_average: 7.25, vote_count: 12 });
    expect(screen.getByText("7.3 / 10")).toBeInTheDocument();
    expect(screen.getByText("Votes: 12")).toBeInTheDocument();
  });

  test("renders the add-to-list button", async () => {
    vi.mocked(getSession).mockResolvedValue(makeSession() as any);
    await renderCard();
    expect(
      screen.getByRole("button", { name: /add to list/i }),
    ).toBeInTheDocument();
  });
});
