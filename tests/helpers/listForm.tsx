import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, test, vi } from "vitest";
import { deferred } from "./deferred";
import { makeUser } from "./factories";

type SessionUser = ReturnType<typeof makeUser>;

export const LIST_ENTRY = {
  movieId: 550,
  title: "Fight Club",
  image: "/i.jpg",
  type: "movie" as const,
};

export type ListFormConfig = {
  name: string;
  // renders the component with LIST_ENTRY and the given session user
  element: (user: SessionUser | undefined) => ReactElement;
  trigger: string | RegExp;
  dialogTitle: string;
  submitText: string;
  loadingText: string;
  successText: string;
  errorText: string;
  refreshes: boolean;
};

// the add/edit list dialogs share one form: status + rating -> PUT /api/add-to-list
export function describeListForm(c: ListFormConfig) {
  const sessionUser = makeUser();
  let user: UserEvent;
  beforeEach(() => {
    user = userEvent.setup();
  });

  const fetchSpy = () => vi.spyOn(globalThis, "fetch");

  async function open() {
    await user.click(screen.getByRole("button", { name: c.trigger }));
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
    await user.click(dialog.getByRole("button", { name: c.submitText }));
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

  describe(c.name, () => {
    test("opens the dialog", async () => {
      render(c.element(sessionUser));
      const dialog = await open();
      expect(dialog.getByText(c.dialogTitle)).toBeInTheDocument();
    });

    test("status is required, rating is optional", async () => {
      render(c.element(sessionUser));
      const dialog = await open();

      const status = dialog.getByLabelText("Status:");
      expect(status).toBeRequired();
      expect(status).toBeInvalid();
      expect(dialog.getByLabelText("Rating (optional):")).not.toBeRequired();
    });

    test("logged out: warns, sends nothing and closes", async () => {
      const fetch = fetchSpy();
      render(c.element(undefined));

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
      render(c.element(sessionUser));

      await fillAndSubmit("Completed", "8");

      expect(fetch).toHaveBeenCalledWith(
        "/api/add-to-list",
        expect.objectContaining({ method: "PUT" }),
      );
      // no userId: the route takes it from the session (B1)
      expect(JSON.parse(String(fetch.mock.calls[0][1]!.body))).toEqual({
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
      render(c.element(sessionUser));

      await fillAndSubmit("Watching");

      expect(JSON.parse(String(fetch.mock.calls[0][1]!.body))).toMatchObject({
        status: "Watching",
        rating: "",
      });
    });

    test("success toast names the title", async () => {
      fetchSpy().mockResolvedValue(
        Response.json({ addToListResult: "success" }),
      );
      render(c.element(sessionUser));

      await fillAndSubmit();

      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith(
          c.successText,
          expect.anything(),
        ),
      );
      expect(toast.error).not.toHaveBeenCalled();
    });

    it.each(replies.slice(1))("error toast on %s", async (_, reply) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      fetchSpy().mockImplementation(reply);
      render(c.element(sessionUser));

      await fillAndSubmit();

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          c.errorText,
          expect.anything(),
        ),
      );
      expect(toast.success).not.toHaveBeenCalled();
    });

    test(`shows ${c.loadingText} and disables submit while in flight`, async () => {
      const response = deferred<Response>();
      fetchSpy().mockReturnValue(response.promise);
      render(c.element(sessionUser));

      await fillAndSubmit();

      const submit = within(screen.getByRole("dialog")).getByRole("button", {
        name: c.loadingText,
      });
      expect(submit).toBeDisabled();

      response.resolve(Response.json({ addToListResult: "success" }));
      await dialogClosed();
      expect(screen.queryByText(c.loadingText)).toBeNull();
    });

    it.each(replies)(
      "closes and resets the form after %s",
      async (_, reply) => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        fetchSpy().mockImplementation(reply);
        render(c.element(sessionUser));

        await fillAndSubmit("Completed", "8");
        await dialogClosed();

        const dialog = await open();
        expect(dialog.getByLabelText("Status:")).toHaveValue("");
        expect(dialog.getByLabelText("Rating (optional):")).toHaveValue("");
      },
    );

    if (c.refreshes) {
      it.each(replies)("refreshes the page after %s", async (_, reply) => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        fetchSpy().mockImplementation(reply);
        render(c.element(sessionUser));

        await fillAndSubmit();

        await waitFor(() => expect(useRouter().refresh).toHaveBeenCalledOnce());
      });
    }
  });
}
