import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import SubmitBtn from "@/Components/ui/SubmitBtn";

describe("SubmitBtn", () => {
  test("a submit button named btn with the search target as value", () => {
    render(<SubmitBtn searchTarget="tv">Search TV shows</SubmitBtn>);
    const button = screen.getByRole("button", { name: "Search TV shows" });
    expect(button).toHaveAttribute("name", "btn");
    expect(button).toHaveAttribute("value", "tv");
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toBeEnabled();
  });

  test("pending: Generating..., disabled", () => {
    render(
      <SubmitBtn searchTarget="tv" pending>
        Search TV shows
      </SubmitBtn>,
    );
    const button = screen.getByRole("button", { name: "Generating..." });
    expect(button).toBeDisabled();
    expect(screen.queryByText("Search TV shows")).toBeNull();
  });
});
