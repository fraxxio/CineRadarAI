import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ListEntryDialog from "./ListEntryDialog";
import { describeListForm, LIST_ENTRY } from "../testing/listForm";

describeListForm({
  name: "ListEntryDialog",
  element: (signedIn) => (
    <ListEntryDialog signedIn={signedIn} {...LIST_ENTRY} />
  ),
  trigger: /add to list/i,
  dialogTitle: "Choose options to add to the list.",
  submitText: "Add to list",
  loadingText: "Adding...",
  successText: "Fight Club was added to the list.",
  errorText: "Something went wrong while adding to the list.",
});

// Details renders the full-size trigger, search results the corner one
describe("ListEntryDialog trigger", () => {
  it.each([
    [true, "mt-6"],
    [false, "absolute"],
  ])(
    "fullSize %s -> %s trigger that opens the dialog",
    async (fullSize, cls) => {
      render(<ListEntryDialog signedIn fullSize={fullSize} {...LIST_ENTRY} />);
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
