import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, test, vi } from "vitest";
import RemoveEntryButton from "./RemoveEntryButton";
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

const fetchSpy = () => vi.spyOn(globalThis, "fetch");

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
  [
    "success",
    () => Promise.resolve(Response.json({ addToListResult: "success" })),
  ],
  ["fail", () => Promise.resolve(Response.json({ addToListResult: "fail" }))],
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

  test("sends a DELETE with the movie id and type in headers", async () => {
    const fetch = fetchSpy().mockResolvedValue(
      Response.json({ addToListResult: "success" }),
    );
    render(<RemoveEntryButton {...props} />);

    await remove();

    expect(fetch).toHaveBeenCalledWith(
      "/api/remove-from-list",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({ movieId: "550", type: "tv" }),
      }),
    );
    // only the entry key: the route takes the user from the session (B2)
    const headers = fetch.mock.calls[0][1]!.headers as Record<string, string>;
    expect(Object.keys(headers)).toEqual(["movieId", "type"]);
  });

  test("success toast names the title", async () => {
    fetchSpy().mockResolvedValue(Response.json({ addToListResult: "success" }));
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
    fetchSpy().mockImplementation(reply);
    render(<RemoveEntryButton {...props} />);

    await remove();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(ERROR_TEXT, expect.anything()),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it.each(replies)("refreshes and closes after %s", async (_, reply) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchSpy().mockImplementation(reply);
    render(<RemoveEntryButton {...props} />);

    await remove();

    await dialogClosed();
    expect(useRouter().refresh).toHaveBeenCalledOnce();
  });

  test("shows Removing... and disables the button while in flight", async () => {
    const response = deferred<Response>();
    fetchSpy().mockReturnValue(response.promise);
    render(<RemoveEntryButton {...props} />);

    await remove();

    const button = within(screen.getByRole("dialog")).getByRole("button", {
      name: "Removing...",
    });
    expect(button).toBeDisabled();

    response.resolve(Response.json({ addToListResult: "success" }));
    await dialogClosed();
    expect(screen.queryByText("Removing...")).toBeNull();
  });
});
