import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import FilterLink, { FilterGroup } from "./FilterLink";

describe("FilterLink", () => {
  test("active: a link marked as the current page", () => {
    render(
      <FilterLink href="/my-list?sort=rating-asc" isActive>
        Lowest rated
      </FilterLink>,
    );
    const link = screen.getByRole("link", { name: "Lowest rated" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveAttribute("href", "/my-list?sort=rating-asc");
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("inactive: a plain link to href", () => {
    render(
      <FilterLink href="/my-list?sort=rating-asc" isActive={false}>
        Lowest rated
      </FilterLink>,
    );
    const link = screen.getByRole("link", { name: "Lowest rated" });
    expect(link).toHaveAttribute("href", "/my-list?sort=rating-asc");
    expect(link).not.toHaveAttribute("aria-current");
  });
});

describe("FilterGroup", () => {
  test("a group named by its visible label", () => {
    render(
      <FilterGroup id="type-label" label="Type">
        <FilterLink href="/my-list?type=tv" isActive={false}>
          TV
        </FilterLink>
      </FilterGroup>,
    );
    const group = screen.getByRole("group", { name: "Type" });
    expect(group).toContainElement(screen.getByRole("link", { name: "TV" }));
  });
});
