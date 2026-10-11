import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, expect, test, vi } from "vitest";
import type { RecommendedTitle } from "./protocol";
import { RecommendationCard } from "./RecommendationCard";
import { RecommendationCards } from "./RecommendationCards";

// ListEntryDialog stays real (client component)

const makeTitle = (
  overrides: Partial<RecommendedTitle> = {},
): RecommendedTitle => ({
  type: "movie",
  id: 550,
  title: "Fight Club",
  year: 1999,
  rating: 8.4,
  genres: ["Drama", "Thriller"],
  posterPath: "/p.jpg",
  backdropPath: "/b.jpg",
  reason: "A cult classic about identity and consumerism.",
  ...overrides,
});

const renderCard = (
  overrides: Partial<RecommendedTitle> = {},
  signedIn = true,
) =>
  render(
    <RecommendationCard title={makeTitle(overrides)} signedIn={signedIn} />,
  );

async function addToList(status = "Completed") {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /add to list/i }));
  const dialog = within(screen.getByRole("dialog"));
  await user.selectOptions(dialog.getByLabelText("Status:"), status);
  await user.click(dialog.getByRole("button", { name: "Add to list" }));
}

describe("RecommendationCard", () => {
  test("w342 poster named after the title", () => {
    renderCard();
    expect(screen.getByAltText("Fight Club")).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w342/p.jpg",
    );
  });

  test("poster falls back to the backdrop", () => {
    renderCard({ posterPath: null });
    expect(screen.getByAltText("Fight Club")).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w342/b.jpg",
    );
  });

  test("no poster and no backdrop -> placeholder", () => {
    renderCard({ posterPath: null, backdropPath: null });
    expect(screen.getByLabelText("No image available")).toBeInTheDocument();
    expect(screen.queryByAltText("Fight Club")).toBeNull();
  });

  test.each([
    ["movie", 550, "Fight Club", "/search/movie/550"],
    ["tv", 1399, "Game of Thrones", "/search/tv/1399"],
  ] as const)("%s title links to its page", (type, id, title, href) => {
    renderCard({ type, id, title });
    // the poster link is hidden, so the title is the only link
    expect(screen.getByRole("link")).toHaveAttribute("href", href);
    expect(screen.getByRole("link")).toHaveAccessibleName(title);
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  });

  test("poster links to the same page but is out of the tab order", () => {
    const { container } = renderCard();
    const posterLink = container.querySelector("a[aria-hidden]");
    expect(posterLink).toHaveAttribute("href", "/search/movie/550");
    expect(posterLink).toHaveAttribute("tabindex", "-1");
  });

  test.each([
    ["movie", "1999 · Movie"],
    ["tv", "1999 · TV show"],
  ] as const)("%s shows the year and type", (type, text) => {
    renderCard({ type });
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  test("missing year -> Unknown year", () => {
    renderCard({ year: null });
    expect(screen.getByText("Unknown year · Movie")).toBeInTheDocument();
  });

  test.each([
    [7.5, "7.5 / 10"],
    [8, "8.0 / 10"],
    [null, "Not rated"],
  ])("rating %j -> %s", (rating, text) => {
    renderCard({ rating });
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  test("genres are joined and the reason shows", () => {
    renderCard();
    expect(screen.getByText("Drama · Thriller")).toBeInTheDocument();
    expect(
      screen.getByText("A cult classic about identity and consumerism."),
    ).toBeInTheDocument();
  });

  test("no genres -> no genre line", () => {
    renderCard({ genres: [] });
    const reason = screen.getByText(
      "A cult classic about identity and consumerism.",
    );
    expect(reason.previousElementSibling).toHaveTextContent("8.4 / 10");
  });

  describe("add to list", () => {
    const fetchSpy = () =>
      vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(Response.json({ addToListResult: "success" }));
    const sentBody = (fetch: ReturnType<typeof fetchSpy>) =>
      JSON.parse(String(fetch.mock.calls[0][1]!.body));

    test("signed in: saves the title with its backdrop", async () => {
      const fetch = fetchSpy();
      renderCard();

      await addToList("Planning to watch");

      expect(fetch).toHaveBeenCalledWith(
        "/api/add-to-list",
        expect.objectContaining({ method: "PUT" }),
      );
      expect(sentBody(fetch)).toEqual({
        movieId: "550",
        title: "Fight Club",
        image: "/b.jpg",
        type: "movie",
        status: "Planning to watch",
        rating: "",
      });
      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith(
          "Fight Club was added to the list.",
          expect.anything(),
        ),
      );
    });

    test("no backdrop -> saves the poster", async () => {
      const fetch = fetchSpy();
      renderCard({ type: "tv", id: 1399, backdropPath: null });

      await addToList();

      expect(sentBody(fetch)).toMatchObject({
        movieId: "1399",
        image: "/p.jpg",
        type: "tv",
      });
    });

    test("signed out: warns and sends nothing", async () => {
      const fetch = vi.spyOn(globalThis, "fetch");
      renderCard({}, false);

      await addToList();

      expect(toast.warning).toHaveBeenCalledWith(
        "Failed to add",
        expect.objectContaining({ description: "You need to be logged in!" }),
      );
      expect(fetch).not.toHaveBeenCalled();
    });
  });
});

describe("RecommendationCards", () => {
  test("one item per title, in order, in a Recommendations list", () => {
    render(
      <RecommendationCards
        items={[
          makeTitle({ id: 1, title: "First" }),
          // same id, other type: both stay
          makeTitle({ type: "tv", id: 1, title: "Second" }),
          makeTitle({ id: 3, title: "Third" }),
        ]}
        signedIn
      />,
    );

    const list = screen.getByRole("list", { name: "Recommendations" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(
      items.map((item) => within(item).getByRole("heading").textContent),
    ).toEqual(["First", "Second", "Third"]);
  });
});
