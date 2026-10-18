import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, test } from "vitest";
import ListRow from "./ListRow";
import type { StoredEntry } from "../entry";
import { makeMovie } from "@test/helpers/factories";

const renderRow = (overrides: Partial<StoredEntry> = {}, priority?: boolean) =>
  render(
    <ul>
      <ListRow
        movie={{ ...makeMovie({ movieId: 550 }), ...overrides }}
        tab="all"
        priority={priority}
      />
    </ul>,
  );

const metaLine = () => screen.getByText(/^(Movie|TV) ·/);

describe("ListRow", () => {
  test("is a list item", () => {
    renderRow();
    expect(screen.getByRole("listitem")).toBeInTheDocument();
  });

  test("the title links to the details page", () => {
    renderRow();
    expect(screen.getByRole("link", { name: "Fury" })).toHaveAttribute(
      "href",
      "/search/movie/550",
    );
  });

  test("TV entries link to the TV page and show TV in the meta line", () => {
    renderRow({ type: "tv", rating: 0 });
    expect(screen.getByRole("link", { name: "Fury" })).toHaveAttribute(
      "href",
      "/search/tv/550",
    );
    expect(metaLine()).toHaveTextContent(/^TV · Not rated$/);
  });

  test("a rated movie shows the type and a star rating", () => {
    renderRow({ type: "movie", rating: 8 });
    expect(metaLine()).toHaveTextContent(/^Movie · 8$/);
    const rating = within(metaLine()).getByText("8");
    expect(rating).toHaveClass("text-yellow-500");
    expect(within(rating).getByLabelText("Rating")).toBeInTheDocument();
  });

  test("rating 0 -> Not rated, without a star", () => {
    renderRow({ rating: 0 });
    expect(metaLine()).toHaveTextContent(/^Movie · Not rated$/);
    expect(screen.queryByLabelText("Rating")).toBeNull();
  });

  test("the thumbnail is the w300 image", () => {
    renderRow({ image: "/p.jpg" });
    expect(screen.getByAltText("Fury")).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w300/p.jpg",
    );
  });

  test("the thumbnail is lazy unless the row has priority", () => {
    const { unmount } = renderRow({ image: "/p.jpg" });
    expect(screen.getByAltText("Fury")).toHaveAttribute("loading", "lazy");
    unmount();

    renderRow({ image: "/p.jpg" }, true);
    expect(screen.getByAltText("Fury")).not.toHaveAttribute("loading", "lazy");
  });

  test("no image -> placeholder instead of a broken thumbnail", () => {
    renderRow({ image: "" });
    expect(screen.getByLabelText("No image available")).toBeInTheDocument();
    expect(screen.queryByAltText("Fury")).toBeNull();
  });

  test("no position number", () => {
    renderRow();
    expect(screen.queryByText(/^#\d+$/)).toBeNull();
  });

  it.each([
    ["Watching", "lucide-eye", "text-emerald-300"],
    ["Completed", "lucide-circle-check", "text-sky-300"],
    ["Planning to watch", "lucide-notebook-pen", "text-amber-300"],
    // rows saved before the payload was validated
    ["Dropped", "lucide-notebook-pen", "text-slate-300"],
  ])("status %s -> a badge with the %s icon", (status, icon, color) => {
    renderRow({ status });
    const badge = screen.getByText(status, { selector: "span" });
    expect(badge).toHaveClass(color);
    expect(badge.querySelector(`svg.${icon}`)).not.toBeNull();
  });

  test("edits inline: status and rating selects, and a remove button", () => {
    renderRow({ status: "Watching", rating: 6 });
    expect(screen.getByLabelText("Status for Fury")).toHaveValue("Watching");
    expect(screen.getByLabelText("Rating for Fury")).toHaveValue("6");
    expect(
      screen.getByRole("button", { name: "Remove from list" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit list entry" }),
    ).toBeNull();
  });
});
