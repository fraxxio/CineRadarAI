import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, test, vi } from "vitest";
import ListEntryDialog from "./ListEntryDialog";
import { describeListForm, LIST_ENTRY } from "../testing/listForm";

describeListForm({
  name: "ListEntryDialog (add)",
  element: (signedIn) => (
    <ListEntryDialog mode="add" signedIn={signedIn} {...LIST_ENTRY} />
  ),
  trigger: /add to list/i,
  dialogTitle: "Choose options to add to the list.",
  submitText: "Add to list",
  loadingText: "Adding...",
  successText: "Fight Club was added to the list.",
  errorText: "Something went wrong while adding to the list.",
  refreshes: false,
});

describeListForm({
  name: "ListEntryDialog (edit)",
  // a legacy status and no rating open empty, like add mode
  element: (signedIn) => (
    <ListEntryDialog
      mode="edit"
      signedIn={signedIn}
      {...LIST_ENTRY}
      status="Dropped"
      rating={0}
    />
  ),
  trigger: "Edit list entry",
  dialogTitle: "Edit the list",
  submitText: "Save",
  loadingText: "Saving...",
  successText: "Fight Club was updated.",
  errorText: "Something went wrong while editing the list.",
  refreshes: true,
});

// Details renders the full-size trigger, search results the corner one
describe("ListEntryDialog add trigger", () => {
  it.each([
    [true, "mt-6"],
    [false, "absolute"],
  ])(
    "fullSize %s -> %s trigger that opens the dialog",
    async (fullSize, cls) => {
      render(
        <ListEntryDialog
          mode="add"
          signedIn
          fullSize={fullSize}
          {...LIST_ENTRY}
        />,
      );
      const trigger = screen.getByRole("button", { name: /add to list/i });
      expect(trigger).toHaveClass(cls);
      expect(trigger.innerHTML).not.toMatch(/undefined|false/);

      await userEvent.click(trigger);
      expect(screen.getByRole("dialog")).toHaveTextContent(
        "Choose options to add to the list.",
      );
    },
  );
});

describe("ListEntryDialog initial values", () => {
  async function open(trigger: string | RegExp) {
    await userEvent.click(screen.getByRole("button", { name: trigger }));
    const dialog = within(screen.getByRole("dialog"));
    return {
      dialog,
      status: dialog.getByLabelText("Status:"),
      rating: dialog.getByLabelText("Rating (optional):"),
    };
  }

  const renderEdit = (status: string, rating: number) =>
    render(
      <ListEntryDialog
        mode="edit"
        signedIn
        {...LIST_ENTRY}
        status={status}
        rating={rating}
      />,
    );

  test("edit opens with the current status and rating", async () => {
    renderEdit("Completed", 8);
    const { status, rating } = await open("Edit list entry");
    expect(status).toHaveValue("Completed");
    expect(rating).toHaveValue("8");
  });

  test("changing only the status keeps the rating", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ addToListResult: "success" }));
    renderEdit("Completed", 8);
    const { dialog, status } = await open("Edit list entry");

    await userEvent.selectOptions(status, "Watching");
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));

    expect(JSON.parse(String(fetch.mock.calls[0][1]!.body))).toMatchObject({
      status: "Watching",
      rating: "8",
    });
  });

  test("a legacy status opens with Choose status", async () => {
    renderEdit("Dropped", 8);
    const { status, rating } = await open("Edit list entry");
    expect(status).toHaveValue("");
    expect(
      screen.getByRole("option", { name: "Choose status" }),
    ).toHaveProperty("selected", true);
    expect(rating).toHaveValue("8");
  });

  test("rating 0 opens with Add rating", async () => {
    renderEdit("Watching", 0);
    const { status, rating } = await open("Edit list entry");
    expect(status).toHaveValue("Watching");
    expect(rating).toHaveValue("");
    expect(screen.getByRole("option", { name: "Add rating" })).toHaveProperty(
      "selected",
      true,
    );
  });

  test("cancelling and reopening shows the current values again", async () => {
    renderEdit("Completed", 8);
    const first = await open("Edit list entry");
    await userEvent.selectOptions(first.status, "Watching");
    await userEvent.selectOptions(first.rating, "");
    await userEvent.keyboard("{Escape}");

    const { status, rating } = await open("Edit list entry");
    expect(status).toHaveValue("Completed");
    expect(rating).toHaveValue("8");
  });

  test("reopening after a refresh shows the saved values", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ addToListResult: "success" }),
    );
    const { rerender } = renderEdit("Completed", 8);
    const first = await open("Edit list entry");
    await userEvent.selectOptions(first.status, "Watching");
    await userEvent.click(first.dialog.getByRole("button", { name: "Save" }));

    // router.refresh() re-renders the row with the stored values
    rerender(
      <ListEntryDialog
        mode="edit"
        signedIn
        {...LIST_ENTRY}
        status="Watching"
        rating={8}
      />,
    );
    const { status, rating } = await open("Edit list entry");
    expect(status).toHaveValue("Watching");
    expect(rating).toHaveValue("8");
  });

  test("add mode opens empty", async () => {
    render(<ListEntryDialog mode="add" signedIn {...LIST_ENTRY} />);
    const { status, rating } = await open(/add to list/i);
    expect(status).toHaveValue("");
    expect(rating).toHaveValue("");
  });
});
