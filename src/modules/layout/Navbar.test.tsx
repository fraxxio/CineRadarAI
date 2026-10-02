import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, test } from "vitest";
import Navbar from "./Navbar";
import { makeUser } from "@test/helpers/factories";

// Logged in, AuthBtn renders twice (desktop + mobile). Visibility comes from
// Tailwind classes, which jsdom doesn't apply, so the tests assert on classes.

const sessionUser = makeUser({ name: "Ada", email: "ada@test.local" });

const dropdown = (i = 0) =>
  screen.getAllByText("Logged in as:")[i].closest(".absolute") as HTMLElement;

describe("Navbar", () => {
  test("logged out: Sign In links, no account menu", () => {
    render(<Navbar user={undefined} />);

    const signIn = screen.getAllByRole("link", { name: "Sign In" });
    expect(signIn).toHaveLength(2);
    for (const link of signIn) expect(link).toHaveAttribute("href", "/signin");
    expect(screen.queryByRole("button", { name: "Account menu" })).toBeNull();
  });

  test("logged in: two avatar buttons, no Sign In", () => {
    render(<Navbar user={sessionUser} />);

    expect(
      screen.getAllByRole("button", { name: "Account menu" }),
    ).toHaveLength(2);
    expect(screen.getAllByAltText("Profile")[0]).toHaveAttribute(
      "src",
      sessionUser.image,
    );
    expect(screen.queryByRole("link", { name: "Sign In" })).toBeNull();
  });

  test("the avatar toggles its dropdown", async () => {
    const user = userEvent.setup();
    render(<Navbar user={sessionUser} />);
    const avatar = screen.getAllByRole("button", { name: "Account menu" })[0];

    expect(dropdown()).toHaveClass("hidden");
    await user.click(avatar);
    expect(dropdown()).toHaveClass("block");
    expect(dropdown()).not.toHaveClass("hidden");
    expect(dropdown()).toHaveTextContent("Ada");
    expect(dropdown()).toHaveTextContent("ada@test.local");
    expect(dropdown()).toHaveTextContent("Delete my account");
    expect(dropdown()).toHaveTextContent("Sign Out");
    expect(dropdown(1)).toHaveClass("hidden"); // the mobile copy stays closed

    await user.click(avatar);
    expect(dropdown()).toHaveClass("hidden");
  });

  test("a click outside closes the dropdown", async () => {
    render(<Navbar user={sessionUser} />);
    await userEvent
      .setup()
      .click(screen.getAllByRole("button", { name: "Account menu" })[0]);
    expect(dropdown()).toHaveClass("block");

    fireEvent.mouseDown(dropdown()); // inside: stays open
    expect(dropdown()).toHaveClass("block");

    fireEvent.mouseDown(document.body);
    expect(dropdown()).toHaveClass("hidden");
  });

  test("the mobile toggle swaps the icons and slides the menu", async () => {
    const user = userEvent.setup();
    const { container } = render(<Navbar user={undefined} />);
    const toggle = screen.getByRole("button", { name: "Toggle menu" });
    const menu = container.querySelector("#menu")!;
    const x = container.querySelector("#x")!;
    const mobileNav = container.querySelector("#MobileNav")!;

    expect(mobileNav).toHaveClass("-translate-y-[10rem]");
    expect(x).toHaveClass("hidden");

    await user.click(toggle);
    expect(menu).toHaveClass("hidden");
    expect(x).not.toHaveClass("hidden");
    expect(mobileNav).toHaveClass("translate-y-[4rem]");
    expect(mobileNav).not.toHaveClass("-translate-y-[10rem]");

    await user.click(toggle);
    expect(menu).not.toHaveClass("hidden");
    expect(x).toHaveClass("hidden");
    expect(mobileNav).toHaveClass("-translate-y-[10rem]");
    expect(mobileNav).not.toHaveClass("translate-y-[4rem]");
  });

  it.each([
    ["Manual Search", "/search"],
    ["My list", "/my-list"],
    ["About", "/about"],
  ])("%s links to %s (desktop and mobile)", (name, href) => {
    render(<Navbar user={sessionUser} />);
    const links = screen.getAllByRole("link", { name });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute("href", href);
  });

  test("the logo links home", () => {
    render(<Navbar user={undefined} />);
    expect(screen.getByRole("link", { name: /CineRadar/ })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
