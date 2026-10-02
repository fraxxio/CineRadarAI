import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import ListTypeSelect from "./ListTypeSelect";

const values = () =>
  Array.from(screen.getByRole("combobox").querySelectorAll("option")).map(
    (o) => o.value,
  );

describe("ListTypeSelect", () => {
  test("options and required", () => {
    render(<ListTypeSelect status="" setStatus={vi.fn()} />);
    expect(values()).toEqual([
      "",
      "Planning to watch",
      "Completed",
      "Watching",
    ]);
    expect(screen.getByRole("combobox")).toBeRequired();
  });

  test("selecting calls setStatus", async () => {
    const setStatus = vi.fn();
    render(<ListTypeSelect status="" setStatus={setStatus} />);

    await userEvent
      .setup()
      .selectOptions(screen.getByRole("combobox"), "Watching");

    expect(setStatus).toHaveBeenCalledWith("Watching");
  });

  test("shows the controlled value", () => {
    render(<ListTypeSelect status="Completed" setStatus={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveValue("Completed");
  });
});
