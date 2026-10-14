import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";
import { SignInCard } from "./SignInCard";
import { pendingSave } from "./testing/listParts";

// jsdom can't navigate; React's handlers have run by the time this does
const preventSubmit = (e: Event) => e.preventDefault();
beforeEach(() => document.addEventListener("submit", preventSubmit));
afterEach(() => document.removeEventListener("submit", preventSubmit));

const otherOptions = () =>
  screen.getByRole("link", { name: "Other sign-in options" });

describe("SignInCard", () => {
  test("one title: its poster and name", () => {
    const { container } = render(
      <SignInCard saves={[pendingSave()]} onSignIn={vi.fn()} />,
    );

    expect(
      screen.getByText(
        (_, el) => el?.textContent === "Sign in to add Fury to your list",
      ),
    ).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w92/fury.jpg",
    );
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
        onSignIn={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Sign in to add 3 titles to your list"),
    ).toBeInTheDocument();
    const names = within(screen.getByRole("list"))
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(names).toEqual(["Fury", "Dune", "Fury Show"]);
  });

  test("provider buttons that come back to the chat, and the other options", () => {
    const { container } = render(
      <SignInCard saves={[pendingSave()]} onSignIn={vi.fn()} />,
    );

    expect(
      screen.getByRole("button", { name: "Sign in with Google" }),
    ).toHaveAttribute("value", "google");
    expect(
      screen.getByRole("button", { name: "Sign in with GitHub" }),
    ).toHaveAttribute("value", "github");
    expect(
      container.querySelector('input[type="hidden"][name="callbackUrl"]'),
    ).toHaveValue("/");
    expect(otherOptions()).toHaveAttribute("href", "/signin?callbackUrl=/");
  });

  it.each([
    ["Google", () => screen.getByRole("button", { name: /Google/ })],
    ["GitHub", () => screen.getByRole("button", { name: /GitHub/ })],
    ["the other options", otherOptions],
  ])("a click on %s keeps the titles for after the sign-in", async (_, target) => {
    const onSignIn = vi.fn();
    const saves = [pendingSave(), pendingSave({ id: 1, title: "Dune" })];
    render(<SignInCard saves={saves} onSignIn={onSignIn} />);

    await userEvent.setup().click(target());

    expect(onSignIn).toHaveBeenCalledExactlyOnceWith(saves);
  });
});
