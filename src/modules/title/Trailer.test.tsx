import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import Trailer from "./Trailer";
import { mockTmdb } from "@test/helpers/tmdb";

const video = (type: string, key: string, site = "YouTube") => ({
  type,
  key,
  site,
  name: key,
  id: key,
});

const renderTrailer = async (results: object[]) => {
  const spy = mockTmdb({ "/3/tv/1399/videos": { id: 1399, results } });
  render(await Trailer({ id: 1399, mediaType: "tv" }));
  return spy;
};

describe("Trailer", () => {
  test("embeds the first video of type Trailer", async () => {
    const spy = await renderTrailer([
      video("Teaser", "a"),
      video("Trailer", "b"),
      video("Trailer", "c"),
    ]);

    expect(screen.getByTitle("Trailer")).toHaveAttribute(
      "src",
      "https://www.youtube.com/embed/b",
    );
    expect(
      new URL(String(spy.mock.lastCall![0])).searchParams.get("language"),
    ).toBe("en-US");
  });

  test("no trailer -> No trailer.", async () => {
    await renderTrailer([video("Teaser", "a"), video("Featurette", "b")]);
    expect(screen.getByText("No trailer.")).toBeInTheDocument();
    expect(screen.queryByTitle("Trailer")).toBeNull();
  });

  test("a TMDB error rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockTmdb({ "/3/tv/1399/videos": new Response("x", { status: 500 }) });
    await expect(Trailer({ id: 1399, mediaType: "tv" })).rejects.toThrow(
      "Failed to fetch tv trailer (Status: 500)",
    );
  });

  test("ignores non-YouTube trailers", async () => {
    await renderTrailer([
      video("Trailer", "vimeo-key", "Vimeo"),
      video("Trailer", "yt-key"),
    ]);
    expect(screen.getByTitle("Trailer")).toHaveAttribute(
      "src",
      "https://www.youtube.com/embed/yt-key",
    );
  });

  test("only non-YouTube trailers -> No trailer.", async () => {
    await renderTrailer([video("Trailer", "vimeo-key", "Vimeo")]);
    expect(screen.getByText("No trailer.")).toBeInTheDocument();
  });
});
