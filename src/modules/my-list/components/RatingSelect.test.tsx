import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import RatingSelect from "./RatingSelect";

describe("RatingSelect", () => {
  test("an empty option, then 1 to 10; not required", () => {
    render(<RatingSelect rating="" setRating={vi.fn()} />);
    const select = screen.getByRole("combobox");
    const values = Array.from(select.querySelectorAll("option")).map(
      (o) => o.value,
    );
    expect(values).toEqual([
      "",
      ...Array.from({ length: 10 }, (_, i) => `${i + 1}`),
    ]);
    expect(select).not.toBeRequired();
  });

  test("selecting calls setRating", async () => {
    const setRating = vi.fn();
    render(<RatingSelect rating="" setRating={setRating} />);

    await userEvent.setup().selectOptions(screen.getByRole("combobox"), "7");

    expect(setRating).toHaveBeenCalledWith("7");
  });
});
