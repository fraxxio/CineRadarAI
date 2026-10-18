import { render, screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, test, vi } from "vitest";
import RowEditor from "./RowEditor";
import { updateEntryRating, updateEntryStatus } from "../actions";
import type { ListStatusFilter } from "../view";
import { deferred } from "@test/helpers/deferred";

const key = { movieId: 550, type: "movie" as const };
const ERROR_TEXT = "Something went wrong while saving.";

let user: UserEvent;
beforeEach(() => {
  user = userEvent.setup();
});

const renderEditor = ({
  status = "Completed",
  rating = 8,
  tab = "all" as ListStatusFilter,
} = {}) =>
  render(
    <RowEditor
      entryKey={key}
      title="Fight Club"
      status={status}
      rating={rating}
      tab={tab}
    />,
  );

const statusSelect = () => screen.getByLabelText("Status for Fight Club");
const ratingSelect = () => screen.getByLabelText("Rating for Fight Club");

describe("RowEditor", () => {
  test("shows the entry's status and rating", () => {
    renderEditor({ status: "Watching", rating: 6 });
    expect(statusSelect()).toHaveValue("Watching");
    expect(ratingSelect()).toHaveValue("6");
  });

  test("rating 0 shows Not rated", () => {
    renderEditor({ rating: 0 });
    expect(ratingSelect()).toHaveValue("0");
    expect(screen.getByRole("option", { name: "Not rated" })).toHaveProperty(
      "selected",
      true,
    );
  });

  test("a legacy status shows as a disabled option", () => {
    renderEditor({ status: "Dropped" });
    expect(statusSelect()).toHaveValue("Dropped");
    expect(screen.getByRole("option", { name: "Dropped" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Watching" })).not.toBeDisabled();
  });

  test("a status change saves only the status", async () => {
    vi.mocked(updateEntryStatus).mockResolvedValue({ ok: true });
    renderEditor();

    await user.selectOptions(statusSelect(), "Watching");

    expect(updateEntryStatus).toHaveBeenCalledExactlyOnceWith(key, "Watching");
    expect(updateEntryRating).not.toHaveBeenCalled();
  });

  test("a rating change saves only the rating, as a number", async () => {
    vi.mocked(updateEntryRating).mockResolvedValue({ ok: true });
    renderEditor();

    await user.selectOptions(ratingSelect(), "3");

    expect(updateEntryRating).toHaveBeenCalledExactlyOnceWith(key, 3);
    expect(updateEntryStatus).not.toHaveBeenCalled();
  });

  test("Not rated saves 0", async () => {
    vi.mocked(updateEntryRating).mockResolvedValue({ ok: true });
    renderEditor();

    await user.selectOptions(ratingSelect(), "Not rated");

    expect(updateEntryRating).toHaveBeenCalledExactlyOnceWith(key, 0);
  });

  test("both selects are disabled while a save is in flight", async () => {
    const reply = deferred<{ ok: boolean }>();
    vi.mocked(updateEntryRating).mockReturnValue(
      reply.promise as ReturnType<typeof updateEntryRating>,
    );
    renderEditor();

    await user.selectOptions(ratingSelect(), "3");

    expect(ratingSelect()).toBeDisabled();
    expect(statusSelect()).toBeDisabled();
    expect(ratingSelect()).toHaveValue("3");

    reply.resolve({ ok: true });
    await waitFor(() => expect(ratingSelect()).toBeEnabled());
    expect(statusSelect()).toBeEnabled();
  });

  test("a rating change toasts Saved", async () => {
    vi.mocked(updateEntryRating).mockResolvedValue({ ok: true });
    renderEditor({ tab: "completed" });

    await user.selectOptions(ratingSelect(), "3");

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Saved", expect.anything()),
    );
    expect(ratingSelect()).toHaveValue("3");
  });

  it.each([
    ["all", "Watching", "Saved"],
    ["completed", "Watching", "Moved to Watching"],
    ["completed", "Planning to watch", "Moved to Planning to watch"],
    // a legacy status leaves the Other tab
    ["other", "Completed", "Moved to Completed"],
  ] as const)(
    "on the %s tab, a change to %s toasts %j",
    async (tab, next, text) => {
      vi.mocked(updateEntryStatus).mockResolvedValue({ ok: true });
      renderEditor({ tab, status: tab === "other" ? "Dropped" : "Completed" });

      await user.selectOptions(statusSelect(), next);

      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith(text, expect.anything()),
      );
      expect(toast.error).not.toHaveBeenCalled();
    },
  );

  const failures = [
    ["a failed save", () => Promise.resolve({ ok: false as const })],
    ["a thrown action", () => Promise.reject(new Error("offline"))],
  ] as const;

  it.each(failures)(
    "%s rolls the status back and toasts an error",
    async (_, reply) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(updateEntryStatus).mockImplementation(reply);
      renderEditor({ status: "Completed" });

      await user.selectOptions(statusSelect(), "Watching");

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(ERROR_TEXT, expect.anything()),
      );
      expect(statusSelect()).toHaveValue("Completed");
      expect(statusSelect()).toBeEnabled();
      expect(toast.success).not.toHaveBeenCalled();
    },
  );

  it.each(failures)(
    "%s rolls the rating back and toasts an error",
    async (_, reply) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(updateEntryRating).mockImplementation(reply);
      renderEditor({ rating: 8 });

      await user.selectOptions(ratingSelect(), "3");

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(ERROR_TEXT, expect.anything()),
      );
      expect(ratingSelect()).toHaveValue("8");
    },
  );

  test("a failed save of a legacy status rolls back to it", async () => {
    vi.mocked(updateEntryStatus).mockResolvedValue({ ok: false });
    renderEditor({ status: "Dropped", tab: "other" });

    await user.selectOptions(statusSelect(), "Watching");

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(statusSelect()).toHaveValue("Dropped");
  });

  test("new saved values from the revalidated page replace the shown ones", async () => {
    const { rerender } = renderEditor({ status: "Completed", rating: 8 });

    rerender(
      <RowEditor
        entryKey={key}
        title="Fight Club"
        status="Watching"
        rating={2}
        tab="all"
      />,
    );

    expect(statusSelect()).toHaveValue("Watching");
    expect(ratingSelect()).toHaveValue("2");
  });
});
