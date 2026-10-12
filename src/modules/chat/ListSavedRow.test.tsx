import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, expect, it, test, vi } from "vitest";
import { ListSavedRow } from "./ListSavedRow";
import type { ListSavedPart } from "./protocol";
import { listSavedPart, previousEntry } from "./testing/listParts";

const undoBtn = () => screen.queryByRole("button", { name: "Undo Fury" });

const renderRow = (
  part: ListSavedPart,
  onUndo: (() => Promise<boolean>) | undefined = vi.fn(async () => true),
) => render(<ListSavedRow part={part} onUndo={onUndo} />);

describe("ListSavedRow", () => {
  it.each<[string, ListSavedPart, string]>([
    ["a new title", listSavedPart(), "Added to your list · Planning to watch"],
    [
      "a status change",
      listSavedPart({ status: "Completed" }, previousEntry()),
      "Moved to Completed (was Watching)",
    ],
    [
      "nothing changed",
      listSavedPart({ status: "Watching" }, previousEntry()),
      "Already in your list · Watching",
    ],
    [
      "a legacy status before",
      listSavedPart({}, previousEntry({ status: "Dropped" })),
      "Moved to Planning to watch (was Dropped)",
    ],
  ])("%s", (_, part, line) => {
    renderRow(part);
    expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fury" })).toHaveAttribute(
      "href",
      "/search/movie/228150",
    );
  });

  test("the w92 poster, or the saved image without one", () => {
    const { container, rerender } = renderRow(listSavedPart());
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w92/fury.jpg",
    );

    rerender(<ListSavedRow part={listSavedPart({ posterPath: null })} />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w92/fury-backdrop.jpg",
    );
  });

  test("Undo calls onUndo once and waits for it", async () => {
    let finish!: (ok: boolean) => void;
    const onUndo = vi.fn(
      () => new Promise<boolean>((resolve) => (finish = resolve)),
    );
    renderRow(listSavedPart(), onUndo);

    await userEvent.click(undoBtn()!);

    expect(onUndo).toHaveBeenCalledOnce();
    expect(undoBtn()).toBeDisabled();
    expect(undoBtn()).toHaveTextContent("Undoing...");
    finish(true);
    await waitFor(() => expect(undoBtn()).toBeEnabled());
    expect(toast.error).not.toHaveBeenCalled();
  });

  test("a failed Undo shows an error toast and keeps the button", async () => {
    renderRow(
      listSavedPart(),
      vi.fn(async () => false),
    );

    await userEvent.click(undoBtn()!);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Something went wrong while undoing.",
        expect.anything(),
      ),
    );
    expect(undoBtn()).toBeEnabled();
  });

  test("undone: says so, no button", () => {
    renderRow(listSavedPart({}, null, true));
    expect(screen.getByText("Undone")).toBeInTheDocument();
    expect(undoBtn()).toBeNull();
  });

  test("nothing changed: no Undo", () => {
    renderRow(listSavedPart({ status: "Watching" }, previousEntry()));
    expect(undoBtn()).toBeNull();
  });

  test("streaming: no Undo yet, and the row is announced", () => {
    const { container } = render(<ListSavedRow part={listSavedPart()} />);
    expect(undoBtn()).toBeNull();
    expect(container.firstChild).toHaveAttribute("aria-live", "polite");
  });

  test("finished: not announced again", () => {
    const { container } = renderRow(listSavedPart());
    expect(container.firstChild).not.toHaveAttribute("aria-live");
  });
});
