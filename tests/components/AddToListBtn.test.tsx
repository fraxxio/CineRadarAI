import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, test, vi } from "vitest";
import AddToListBtn from "@/Components/ui/AddToListBtn";
import { deferred } from "../helpers/deferred";
import { makeUser } from "../helpers/factories";

const sessionUser = makeUser();
const props = {
  user: sessionUser,
  movieId: 550,
  title: "Fight Club",
  image: "/i.jpg",
  type: "movie" as const,
};

let user: UserEvent;
beforeEach(() => {
  user = userEvent.setup();
});

const fetchSpy = () => vi.spyOn(globalThis, "fetch");

async function open() {
  await user.click(screen.getByRole("button", { name: /add to list/i }));
  return within(screen.getByRole("dialog"));
}

async function fillAndSubmit(status = "Completed", rating?: string) {
  const dialog = await open();
  await user.selectOptions(dialog.getByLabelText("Status:"), status);
  if (rating) {
    await user.selectOptions(
      dialog.getByLabelText("Rating (optional):"),
      rating,
    );
  }
  await user.click(dialog.getByRole("button", { name: "Add to list" }));
}

const dialogClosed = () =>
  waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

describe("AddToListBtn", () => {
  test("opens the dialog", async () => {
    render(<AddToListBtn {...props} />);
    const dialog = await open();
    expect(
      dialog.getByText("Choose options to add to the list."),
    ).toBeInTheDocument();
  });

  test("status is required, rating is optional", async () => {
    render(<AddToListBtn {...props} />);
    const dialog = await open();

    const status = dialog.getByLabelText("Status:");
    expect(status).toBeRequired();
    expect(status).toBeInvalid();
    expect(dialog.getByLabelText("Rating (optional):")).not.toBeRequired();
  });

  test("logged out: warns, sends nothing and closes", async () => {
    const fetch = fetchSpy();
    render(<AddToListBtn {...props} user={undefined} />);

    await fillAndSubmit();

    expect(toast.warning).toHaveBeenCalledWith(
      "Failed to add",
      expect.objectContaining({ description: "You need to be logged in!" }),
    );
    expect(fetch).not.toHaveBeenCalled();
    await dialogClosed();
  });

  test("sends a PUT with the list entry", async () => {
    const fetch = fetchSpy().mockResolvedValue(
      Response.json({ addToListResult: "success" }),
    );
    render(<AddToListBtn {...props} />);

    await fillAndSubmit("Completed", "8");

    expect(fetch).toHaveBeenCalledWith(
      "/api/add-to-list",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(JSON.parse(String(fetch.mock.calls[0][1]!.body))).toEqual({
      userId: sessionUser.id,
      movieId: "550",
      title: "Fight Club",
      image: "/i.jpg",
      status: "Completed",
      rating: "8",
      type: "movie",
    });
  });

  test("sends an empty rating when none is chosen", async () => {
    const fetch = fetchSpy().mockResolvedValue(
      Response.json({ addToListResult: "success" }),
    );
    render(<AddToListBtn {...props} />);

    await fillAndSubmit("Watching");

    expect(JSON.parse(String(fetch.mock.calls[0][1]!.body))).toMatchObject({
      status: "Watching",
      rating: "",
    });
  });

  test("success toast names the title", async () => {
    fetchSpy().mockResolvedValue(Response.json({ addToListResult: "success" }));
    render(<AddToListBtn {...props} />);

    await fillAndSubmit();

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Fight Club was added to the list.",
        expect.anything(),
      ),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a fail result",
      () => Promise.resolve(Response.json({ addToListResult: "fail" })),
    ],
    ["a network error", () => Promise.reject(new TypeError("offline"))],
  ])("error toast on %s", async (_, reply) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchSpy().mockImplementation(reply);
    render(<AddToListBtn {...props} />);

    await fillAndSubmit();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Something went wrong while adding to the list.",
        expect.anything(),
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  test("shows Adding... and disables submit while in flight", async () => {
    const response = deferred<Response>();
    fetchSpy().mockReturnValue(response.promise);
    render(<AddToListBtn {...props} />);

    await fillAndSubmit();

    const submit = within(screen.getByRole("dialog")).getByRole("button", {
      name: /adding/i,
    });
    expect(submit).toBeDisabled();

    response.resolve(Response.json({ addToListResult: "success" }));
    await dialogClosed();
    expect(screen.queryByText("Adding...")).toBeNull();
  });

  it.each([
    [
      "success",
      () => Promise.resolve(Response.json({ addToListResult: "success" })),
    ],
    ["fail", () => Promise.resolve(Response.json({ addToListResult: "fail" }))],
    ["network error", () => Promise.reject(new TypeError("offline"))],
  ])("closes and resets the form after %s", async (_, reply) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchSpy().mockImplementation(reply);
    render(<AddToListBtn {...props} />);

    await fillAndSubmit("Completed", "8");
    await dialogClosed();

    const dialog = await open();
    expect(dialog.getByLabelText("Status:")).toHaveValue("");
    expect(dialog.getByLabelText("Rating (optional):")).toHaveValue("");
  });
});
