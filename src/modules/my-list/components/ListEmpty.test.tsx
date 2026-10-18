import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import ListEmpty from "./ListEmpty";

describe("ListEmpty", () => {
  test("an empty list links to search", () => {
    render(<ListEmpty filtered={false} chatEnabled={false} />);
    expect(screen.getByText("Your list is empty.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Search for a movie or TV show" }),
    ).toHaveAttribute("href", "/search");
    expect(screen.queryByRole("link", { name: "ask the chat" })).toBeNull();
  });

  test("an empty list hints at the chat when it's enabled", () => {
    render(<ListEmpty filtered={false} chatEnabled />);
    expect(screen.getByRole("link", { name: "ask the chat" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  test("no matches offers a reset", () => {
    render(<ListEmpty filtered chatEnabled />);
    expect(
      screen.getByText("No titles match these filters."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reset filters" })).toHaveAttribute(
      "href",
      "/my-list",
    );
    expect(screen.queryByText("Your list is empty.")).toBeNull();
    expect(screen.queryByRole("link", { name: "ask the chat" })).toBeNull();
  });
});
