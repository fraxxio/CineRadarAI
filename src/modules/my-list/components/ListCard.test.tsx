import { render, screen } from "@testing-library/react";
import { describe, expect, it, test } from "vitest";
import ListCard from "./ListCard";
import { makeMovie, makeUser } from "@test/helpers/factories";

const renderCard = (overrides: Parameters<typeof makeMovie>[0] = {}) =>
  render(
    <ListCard
      movie={makeMovie({ movieId: 550, ...overrides })}
      user={makeUser()}
      index={2}
    />,
  );

describe("ListCard", () => {
  test("the title links to the details page", () => {
    renderCard();
    expect(screen.getByRole("link", { name: "Fury" })).toHaveAttribute(
      "href",
      "/search/movie/550",
    );
  });

  test("TV entries link to the TV page and show the capitalised type", () => {
    renderCard({ type: "tv" });
    expect(screen.getByRole("link", { name: "Fury" })).toHaveAttribute(
      "href",
      "/search/tv/550",
    );
    expect(screen.getByText("Type: Tv")).toBeInTheDocument();
  });

  test("rating 0 -> Not rated", () => {
    renderCard({ rating: 0 });
    expect(screen.getByText("Not rated")).toBeInTheDocument();
  });

  test("a rating is shown as a number", () => {
    renderCard({ rating: 7 });
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.queryByText("Not rated")).toBeNull();
  });

  test("the poster and the 1-based position", () => {
    renderCard({ image: "/p.jpg" });
    expect(screen.getByAltText("Fury")).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w500/p.jpg",
    );
    expect(screen.getByText("#3")).toBeInTheDocument();
  });

  test("no image -> placeholder instead of a broken poster", () => {
    renderCard({ image: "" });
    expect(screen.getByText("No image")).toBeInTheDocument();
    expect(screen.queryByAltText("Fury")).toBeNull();
  });

  it.each([
    ["Watching", "lucide-eye"],
    ["Completed", "lucide-circle-check"],
    ["Planning to watch", "lucide-notebook-pen"],
  ])("status %s -> %s icon", (status, icon) => {
    const { container } = renderCard({ status });
    expect(screen.getByText(status)).toBeInTheDocument();
    expect(container.querySelector(`svg.${icon}`)).not.toBeNull();
  });

  test("renders the edit and remove buttons", () => {
    renderCard();
    expect(
      screen.getByRole("button", { name: "Edit list entry" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove from list" }),
    ).toBeInTheDocument();
  });
});
