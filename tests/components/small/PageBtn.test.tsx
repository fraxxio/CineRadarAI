import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { PageBtn } from "@/Components/ui/PageBtn";
import { buildSearchURL } from "@/lib/utils";

const fv = { query: "Fury", language: "fr", btn: "movie" };

describe("PageBtn", () => {
  test("links to the search URL for its page", () => {
    render(<PageBtn value={3} filterValues={fv} />);
    const button = screen.getByRole("button", { name: "3" });
    expect(button.closest("a")).toHaveAttribute("href", buildSearchURL(fv, 3));
    expect(button).toBeEnabled();
    expect(button).not.toHaveClass("bg-primary-text");
  });

  test("current page: disabled and highlighted", () => {
    render(<PageBtn value={3} filterValues={fv} current />);
    const button = screen.getByRole("button", { name: "3" });
    expect(button).toBeDisabled();
    expect(button).toHaveClass("bg-primary-text");
  });
});
