import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { Navbar } from "@/modules/layout";
import { makeUser } from "../../helpers/factories";

// Phase 1 smoke test: proves jsdom, JSX, jest-dom and the component mocks work.
describe("components infrastructure", () => {
  test("renders a signed-out client component", () => {
    render(<Navbar user={undefined} />);
    expect(screen.getAllByRole("link", { name: "Sign In" })).toHaveLength(2);
    // next/image is a plain <img> (no /_next/image rewrite)
    expect(screen.getByAltText("Logo")).toHaveAttribute(
      "src",
      "/CineRadarLogo.png",
    );
  });

  test("renders the signed-in menu with mocked server actions", async () => {
    const user = makeUser({ name: "Ada" });
    render(<Navbar user={user} />);

    const [accountMenu] = screen.getAllByRole("button", {
      name: "Account menu",
    });
    await userEvent.click(accountMenu);

    expect(screen.getAllByText("Ada")[0]).toBeVisible();
  });
});
