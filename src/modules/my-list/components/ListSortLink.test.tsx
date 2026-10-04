import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import ListSortLink from "./ListSortLink";

describe("ListSortLink", () => {
  test("active: a disabled button, no link", () => {
    render(
      <ListSortLink href="/my-list?rating=asc" isActive>
        Ascending
      </ListSortLink>,
    );
    expect(screen.getByRole("button", { name: "Ascending" })).toBeDisabled();
    expect(screen.queryByRole("link")).toBeNull();
  });

  test("inactive: a link to href", () => {
    render(
      <ListSortLink href="/my-list?rating=asc" isActive={false}>
        Ascending
      </ListSortLink>,
    );
    expect(screen.getByRole("link", { name: "Ascending" })).toHaveAttribute(
      "href",
      "/my-list?rating=asc",
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
