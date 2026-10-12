import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { SignInCard } from "./SignInCard";
import { pendingSave } from "./testing/listParts";

const signInLink = () => screen.getByRole("link", { name: "Sign in" });

describe("SignInCard", () => {
  test("one title: its poster and name", () => {
    const { container } = render(<SignInCard saves={[pendingSave()]} />);

    expect(
      screen.getByText(
        (_, el) => el?.textContent === "Sign in to add Fury to your list",
      ),
    ).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w92/fury.jpg",
    );
    expect(signInLink()).toHaveAttribute("href", "/signin?callbackUrl=/");
  });

  test("several titles: the count and every name", () => {
    render(
      <SignInCard
        saves={[
          pendingSave(),
          pendingSave({ id: 438631, title: "Dune", posterPath: null }),
          // same id, other type
          pendingSave({ type: "tv", title: "Fury Show" }),
        ]}
      />,
    );

    expect(
      screen.getByText("Sign in to add 3 titles to your list"),
    ).toBeInTheDocument();
    const names = within(screen.getByRole("list"))
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(names).toEqual(["Fury", "Dune", "Fury Show"]);
    expect(signInLink()).toHaveAttribute("href", "/signin?callbackUrl=/");
  });
});
