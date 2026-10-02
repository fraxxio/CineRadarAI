import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import MovieCard from "./MovieCard";
import { getSession } from "@/infra/auth/session";
import { makeSession } from "@test/helpers/factories";
import type { TitleSummary } from "@/infra/tmdb";

// AddToListBtn stays real (client component)

const makeResult = (overrides: Partial<TitleSummary> = {}): TitleSummary => ({
  id: 550,
  title: "Fight Club",
  releaseDate: "1999-10-15",
  posterPath: "/p.jpg",
  backdropPath: "/b.jpg",
  voteAverage: 8.4,
  voteCount: 30000,
  ...overrides,
});

const renderCard = async (
  overrides: Partial<TitleSummary> = {},
  type: "movie" | "tv" = "movie",
) => render(await MovieCard({ movie: makeResult(overrides), type }));

beforeEach(() => vi.mocked(getSession).mockReset());

describe("MovieCard", () => {
  test("links to the details page of its type", async () => {
    await renderCard({ id: 7, title: "Show", releaseDate: "2011-04-17" }, "tv");
    const link = screen.getByRole("heading", { name: "Show" }).closest("a");
    expect(link).toHaveAttribute("href", "/search/tv/7");
    expect(screen.getByText("2011-04-17")).toBeInTheDocument();
  });

  test("poster, falling back to the backdrop", async () => {
    await renderCard({ posterPath: null });
    expect(screen.getByAltText("Fight Club")).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w500/b.jpg",
    );
  });

  test("no poster and no backdrop -> No Image", async () => {
    await renderCard({ posterPath: null, backdropPath: null });
    expect(screen.getByText("No Image")).toBeInTheDocument();
    expect(screen.queryByAltText("Fight Club")).toBeNull();
  });

  test("the title is the heading and its tooltip", async () => {
    await renderCard({ title: "Show" }, "tv");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Show");
    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute(
      "title",
      "Show",
    );
  });

  test("rating with one decimal and the vote count", async () => {
    await renderCard({ voteAverage: 7.25, voteCount: 12 });
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
