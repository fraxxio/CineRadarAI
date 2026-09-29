import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import Reviews from "@/Components/Reviews";
import { mockTmdb, tmdbFixture } from "../helpers/tmdb";

const fixture = tmdbFixture("reviews"); // 12 reviews

const review = (
  content: string,
  author = "Critic",
  avatar_path: string | null = "/a.jpg",
) => ({
  author,
  author_details: { name: author, username: author, avatar_path, rating: 6 },
  content,
  created_at: "2024-01-01T00:00:00.000Z",
  id: `${author}-${content.length}`,
  updated_at: "2024-01-01T00:00:00.000Z",
  url: "https://www.themoviedb.org/review/x",
});

const renderReviews = async (results: object[] = fixture.results) => {
  const spy = mockTmdb({ "/3/movie/550/reviews": { ...fixture, results } });
  const view = render(await Reviews({ id: 550, mediaType: "movie" }));
  return { spy, ...view };
};

describe("Reviews", () => {
  test("shows at most 10 reviews", async () => {
    await renderReviews();
    expect(screen.getByText("Reviewer 10")).toBeInTheDocument();
    expect(screen.queryByText("Reviewer 11")).toBeNull();
    expect(screen.getAllByText(/^Rating:/)).toHaveLength(10);
  });

  test("requests page 1 in English", async () => {
    const { spy } = await renderReviews();
    const params = new URL(String(spy.mock.lastCall![0])).searchParams;
    expect(params.get("language")).toBe("en-US");
    expect(params.get("page")).toBe("1");
  });

  test("no reviews -> message", async () => {
    await renderReviews([]);
    expect(screen.getByText("No reviews were found.")).toBeInTheDocument();
  });

  test("avatar, or a placeholder icon when there is none", async () => {
    const { container } = await renderReviews([
      review("hi", "With Avatar", "/me.jpg"),
      review("hi", "No Avatar", null),
    ]);

    expect(screen.getByAltText("With Avatar")).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w500/me.jpg",
    );
    expect(screen.queryByAltText("No Avatar")).toBeNull();
    expect(container.querySelectorAll("svg.lucide-circle-user")).toHaveLength(
      1,
    );
  });

  test("the author's rating", async () => {
    await renderReviews([review("hi")]);
    expect(screen.getByText("6/10")).toBeInTheDocument();
  });

  test("sanitises the review HTML", async () => {
    const { container } = await renderReviews([
      review(
        '<p>ok</p><script>alert(1)</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)">x</a>',
      ),
    ]);

    expect(screen.getByText("ok")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    const img = container.querySelector('img[src="x"]');
    expect(img).not.toBeNull();
    expect(img).not.toHaveAttribute("onerror");
    const link = screen.getByText("x").closest("a")!;
    expect(link.getAttribute("href") ?? "").not.toMatch(/^javascript:/i);
  });

  test("long reviews (> 860 chars) get a hover hint", async () => {
    await renderReviews([
      review("a".repeat(861), "Long"),
      review("b".repeat(860), "Boundary"),
    ]);

    const hints = screen.getAllByText("Hover to reveal");
    expect(hints).toHaveLength(1);
    expect(hints[0].parentElement).toHaveTextContent("Long");
  });

  test("a TMDB error rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockTmdb({ "/3/movie/550/reviews": new Response("x", { status: 500 }) });
    await expect(Reviews({ id: 550, mediaType: "movie" })).rejects.toThrow(
      "Failed to fetch movie reviews (Status: 500)",
    );
  });
});
