import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, test, vi } from "vitest";
import RemoveEntryButton from "./RemoveEntryButton";
import { removeListEntry } from "../actions";
import { deferred } from "@test/helpers/deferred";

const props = {
  movieId: 550,
  title: "Fight Club",
  type: "tv" as const,
};
const ERROR_TEXT = "Something went wrong while removing.";

let user: UserEvent;
beforeEach(() => {
  user = userEvent.setup();
});

const removeMock = () => vi.mocked(removeListEntry);

async function open() {
  await user.click(screen.getByRole("button", { name: "Remove from list" }));
  return within(screen.getByRole("dialog"));
}

async function remove() {
  const dialog = await open();
  await user.click(dialog.getByRole("button", { name: "Remove" }));
}

const dialogClosed = () =>
  waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

const replies = [
  ["success", () => Promise.resolve({ ok: true as const })],
  ["fail", () => Promise.resolve({ ok: false as const })],
  ["network error", () => Promise.reject(new TypeError("offline"))],
] as const;

describe("RemoveEntryButton", () => {
  test("the dialog names the title in bold", async () => {
    render(<RemoveEntryButton {...props} />);
    const dialog = await open();

    expect(dialog.getByText("Fight Club").tagName).toBe("B");
    expect(
      dialog.getByText(/Are you sure you want to remove/),
    ).toHaveTextContent(
      "Are you sure you want to remove Fight Club from your list?",
    );
  });

  test("calls the remove action with the entry key", async () => {
    removeMock().mockResolvedValue({ ok: true });
    render(<RemoveEntryButton {...props} />);

    await remove();

    // only the entry key: the action takes the user from the session
    expect(removeListEntry).toHaveBeenCalledExactlyOnceWith({
      movieId: 550,
      type: "tv",
    });
  });

  test("success toast names the title", async () => {
    removeMock().mockResolvedValue({ ok: true });
    render(<RemoveEntryButton {...props} />);

    await remove();

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Fight Club was removed.",
        expect.anything(),
      ),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it.each(replies.slice(1))("error toast on %s", async (_, reply) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    removeMock().mockImplementation(reply);
    render(<RemoveEntryButton {...props} />);

    await remove();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(ERROR_TEXT, expect.anything()),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  // the action revalidates the page, so there's no router.refresh()
  it.each(replies)("closes after %s", async (_, reply) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    removeMock().mockImplementation(reply);
    render(<RemoveEntryButton {...props} />);

    await remove();

    await dialogClosed();
  });

  test("shows Removing... and disables the button while in flight", async () => {
    const reply = deferred<{ ok: boolean }>();
    removeMock().mockReturnValue(
      reply.promise as ReturnType<typeof removeListEntry>,
    );
    render(<RemoveEntryButton {...props} />);

    await remove();

    const button = within(screen.getByRole("dialog")).getByRole("button", {
      name: "Removing...",
    });
    expect(button).toBeDisabled();

    reply.resolve({ ok: true });
    await dialogClosed();
    expect(screen.queryByText("Removing...")).toBeNull();
  });
});
