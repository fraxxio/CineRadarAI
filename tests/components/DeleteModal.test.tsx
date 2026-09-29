import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFormStatus } from "react-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import DeleteModal from "@/Components/ui/DeleteModal";
import DeleteModalBtn from "@/Components/ui/DeleteModalBtn";

// <form action={fn}> does nothing under React 18.2 in jsdom: submission is covered by E2E 6.5.7

afterEach(() => vi.mocked(useFormStatus).mockReset()); // D18

async function open() {
  render(<DeleteModal id="u1" />);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Delete my account" }));
  return screen.getByRole("dialog", { name: "Are you sure?" });
}

describe("DeleteModal", () => {
  test("opens from Delete my account", async () => {
    const dialog = await open();
    expect(
      within(dialog).getByText(/your movie\/TV show list will be lost/),
    ).toBeInTheDocument();
  });

  test("the confirmation input is required", async () => {
    const dialog = await open();
    const input = within(dialog).getByLabelText(/To permamently delete/);
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("name", "verifyInput");
  });

  test("the hidden id field holds the user id", async () => {
    const dialog = await open();
    const hidden = dialog.querySelector('input[type="hidden"][name="id"]');
    expect(hidden).toHaveValue("u1");
  });
});

describe("DeleteModalBtn", () => {
  test("idle: Delete, enabled", () => {
    render(<DeleteModalBtn setIsOpen={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("type", "submit");
  });

  test("pending: Deleting..., disabled", () => {
    vi.mocked(useFormStatus).mockReturnValue({ pending: true } as any);
    render(<DeleteModalBtn setIsOpen={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled();
  });
});
