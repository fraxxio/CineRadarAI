import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, test, vi } from "vitest";
import DeleteListBtn from "@/Components/ui/DeleteListBtn";
import { deferred } from "../helpers/deferred";

const props = { userId: "u1", movieId: 550, title: "Fight Club" };
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

describe("DeleteListBtn", () => {
  test("the dialog names the title in bold", async () => {
    render(<DeleteListBtn {...props} />);
    const dialog = await open();

    expect(dialog.getByText("Fight Club").tagName).toBe("B");
    expect(
      dialog.getByText(/Are you sure you want to remove/),
    ).toHaveTextContent(
      "Are you sure you want to remove Fight Club from your list?",
    );
  });

  test("no user id: warns, sends nothing and closes", async () => {
    const fetch = fetchSpy();
    render(<DeleteListBtn {...props} userId={undefined as any} />);

    await remove();

    expect(toast.warning).toHaveBeenCalledWith(
      "Failed to add",
      expect.objectContaining({ description: "You need to be logged in!" }),
    );
    expect(fetch).not.toHaveBeenCalled();
    await dialogClosed();
  });

  test("sends a DELETE with the ids in headers", async () => {
    const fetch = fetchSpy().mockResolvedValue(
      Response.json({ addToListResult: "success" }),
    );
    render(<DeleteListBtn {...props} />);

    await remove();

    expect(fetch).toHaveBeenCalledWith(
      "/api/remove-from-list",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({ userId: "u1", movieId: "550" }),
      }),
    );
  });

  test("success toast names the title", async () => {
    fetchSpy().mockResolvedValue(Response.json({ addToListResult: "success" }));
    render(<DeleteListBtn {...props} />);

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
    render(<DeleteListBtn {...props} />);

    await remove();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(ERROR_TEXT, expect.anything()),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it.each(replies)("refreshes and closes after %s", async (_, reply) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchSpy().mockImplementation(reply);
    render(<DeleteListBtn {...props} />);

    await remove();

    await dialogClosed();
    expect(useRouter().refresh).toHaveBeenCalledOnce();
  });

  test("shows Removing... and disables the button while in flight", async () => {
    const response = deferred<Response>();
    fetchSpy().mockReturnValue(response.promise);
    render(<DeleteListBtn {...props} />);

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
