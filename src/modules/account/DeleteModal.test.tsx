import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFormStatus } from "react-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import DeleteModal from "./DeleteModal";
import DeleteModalBtn from "./DeleteModalBtn";

// <form action={fn}> does nothing under React 18.2 in jsdom: submission is covered by E2E 6.5.7

afterEach(() => vi.mocked(useFormStatus).mockReset()); // D18

async function open() {
  render(<DeleteModal />);
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

  test("sends no user id: the action deletes the session user (B3)", async () => {
    const dialog = await open();
    expect(dialog.querySelector('input[name="id"]')).toBeNull();
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

  const status = (pending: boolean) =>
    vi.mocked(useFormStatus).mockReturnValue({ pending } as any);

  test("[B14] a click alone doesn't close the dialog", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const setIsOpen = vi.fn();
    status(false);
    render(<DeleteModalBtn setIsOpen={setIsOpen} />);

    // a blocked submit (empty required input) never starts the action
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(screen.getByRole("button", { name: "Delete" }));
    vi.advanceTimersByTime(1000);

    expect(setIsOpen).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  test("[B14] stays open while the action is pending", () => {
    const setIsOpen = vi.fn();
    status(false);
    const { rerender } = render(<DeleteModalBtn setIsOpen={setIsOpen} />);
    status(true);
    rerender(<DeleteModalBtn setIsOpen={setIsOpen} />);

    expect(setIsOpen).not.toHaveBeenCalled();
  });

  test("[B14] closes once the action has finished", () => {
    const setIsOpen = vi.fn();
    status(true);
    const { rerender } = render(<DeleteModalBtn setIsOpen={setIsOpen} />);
    status(false);
    rerender(<DeleteModalBtn setIsOpen={setIsOpen} />);

    expect(setIsOpen).toHaveBeenCalledOnce();
    expect(setIsOpen).toHaveBeenCalledWith(false);
  });
});
