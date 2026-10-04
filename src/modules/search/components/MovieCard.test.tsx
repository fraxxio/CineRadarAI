import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import MovieCard from "./MovieCard";
import type { TitleSummary } from "@/infra/tmdb";

// ListEntryDialog stays real (client component)

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

const renderCard = (
  overrides: Partial<TitleSummary> = {},
  type: "movie" | "tv" = "movie",
) => render(<MovieCard movie={makeResult(overrides)} type={type} signedIn />);

describe("MovieCard", () => {
  test("links to the details page of its type", () => {
    renderCard({ id: 7, title: "Show", releaseDate: "2011-04-17" }, "tv");
    const link = screen.getByRole("heading", { name: "Show" }).closest("a");
    expect(link).toHaveAttribute("href", "/search/tv/7");
    expect(screen.getByText("2011-04-17")).toBeInTheDocument();
  });

  test("poster, falling back to the backdrop", () => {
    renderCard({ posterPath: null });
    expect(screen.getByAltText("Fight Club")).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w500/b.jpg",
    );
  });

  test("no poster and no backdrop -> No Image", () => {
    renderCard({ posterPath: null, backdropPath: null });
    expect(screen.getByText("No Image")).toBeInTheDocument();
    expect(screen.queryByAltText("Fight Club")).toBeNull();
  });

  test("the title is the heading and its tooltip", () => {
    renderCard({ title: "Show" }, "tv");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Show");
    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute(
      "title",
      "Show",
    );
  });

  test("rating with one decimal and the vote count", () => {
    renderCard({ voteAverage: 7.25, voteCount: 12 });
    expect(screen.getByText("7.3 / 10")).toBeInTheDocument();
    expect(screen.getByText("Votes: 12")).toBeInTheDocument();
  });

  test("renders the add-to-list button", () => {
    renderCard();
    expect(
      screen.getByRole("button", { name: /add to list/i }),
    ).toBeInTheDocument();
  });
});
