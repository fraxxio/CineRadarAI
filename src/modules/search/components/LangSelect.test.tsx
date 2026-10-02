import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import LangSelect from "./LangSelect";
import { lastTmdbUrl, mockTmdb, tmdbFixture } from "@test/helpers/tmdb";

const languages = tmdbFixture<{ iso_639_1: string }[]>("languages").slice(0, 3);

describe("LangSelect", () => {
  test("a placeholder, then one option per language", async () => {
    const spy = mockTmdb({ "/3/configuration/languages": languages });
    render(await LangSelect({ defaultValue: "fr" }));

    const options = screen.getAllByRole("option") as HTMLOptionElement[];
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveTextContent("Choose language");
    expect(options[0].value).toBe("");
    expect(options.slice(1).map((o) => o.value)).toEqual(["en", "fr", "lt"]);
    expect(options[2]).toHaveTextContent("French");
    expect(screen.getByRole("combobox")).toHaveAttribute("name", "language");
    expect(screen.getByRole("combobox")).toHaveValue("fr");
    expect(lastTmdbUrl(spy).pathname).toBe("/3/configuration/languages");
  });

  test("a TMDB error rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockTmdb({
      "/3/configuration/languages": new Response("x", { status: 500 }),
    });
    await expect(LangSelect({})).rejects.toThrow("Failed to fetch languages");
  });
});
