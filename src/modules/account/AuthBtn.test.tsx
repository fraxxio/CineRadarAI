import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import AuthBtn from "./AuthBtn";

const CHAT_KEY = "cineradar.chat.v1";
const USER = {
  id: "u1",
  name: "Ada",
  email: "ada@example.com",
  image: "/ada.png",
};

// jsdom can't navigate; React's handlers have run by the time this does
const preventSubmit = (e: Event) => e.preventDefault();
beforeEach(() => document.addEventListener("submit", preventSubmit));
afterEach(() => document.removeEventListener("submit", preventSubmit));

describe("AuthBtn", () => {
  test("signed out: links to the sign-in page", () => {
    render(<AuthBtn user={undefined} />);
    expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute(
      "href",
      "/signin",
    );
  });

  test("Sign Out clears the saved chat", async () => {
    sessionStorage.setItem(CHAT_KEY, "{}");
    render(<AuthBtn user={USER} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    expect(sessionStorage.getItem(CHAT_KEY)).toBe("{}");
    await user.click(screen.getByRole("button", { name: "Sign Out" }));

    expect(sessionStorage.getItem(CHAT_KEY)).toBeNull();
  });
});
