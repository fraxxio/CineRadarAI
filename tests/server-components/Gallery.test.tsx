import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import Gallery from "@/Components/Gallery";
import { mockTmdb, tmdbFixture } from "../helpers/tmdb";

const images = tmdbFixture("images"); // 12 backdrops

const renderGallery = async (backdrops = images.backdrops) => {
  mockTmdb({ "/3/movie/550/images": { ...images, backdrops } });
  render(await Gallery({ id: 550, mediaType: "movie" }));
};

describe("Gallery", () => {
  test("shows at most 9 images", async () => {
    await renderGallery();
    const shown = screen.getAllByAltText("Gallery image");
    expect(shown).toHaveLength(9);
    expect(shown[0]).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w780/backdrop-1.jpg",
    );
    expect(screen.queryByText("No images were found.")).toBeNull();
  });

  test("no images -> message", async () => {
    await renderGallery([]);
    expect(screen.getByText("No images were found.")).toBeInTheDocument();
    expect(screen.queryByAltText("Gallery image")).toBeNull();
  });

  test("clicking an image opens a larger one with its rating", async () => {
    const [first, ...rest] = images.backdrops;
    await renderGallery([
      { ...first, vote_count: 42, vote_average: 5.612 },
      ...rest,
    ]);

    await userEvent.setup().click(screen.getAllByRole("button")[0]);

    const dialog = screen.getByRole("dialog", {
      name: "42 people rated this picture: 5.6",
    });
    expect(within(dialog).getByAltText("Gallery image")).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w1280/backdrop-1.jpg",
    );
  });

  test("a TMDB error rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockTmdb({ "/3/movie/550/images": new Response("x", { status: 500 }) });
    await expect(Gallery({ id: 550, mediaType: "movie" })).rejects.toThrow(
      "Failed to fetch movie images (Status: 500)",
    );
  });
});
