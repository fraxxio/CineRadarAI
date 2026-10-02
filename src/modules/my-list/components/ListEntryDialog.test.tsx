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
  element: (signedIn) => (
    <ListEntryDialog mode="edit" signedIn={signedIn} {...LIST_ENTRY} />
  ),
  trigger: "Edit list entry",
  dialogTitle: "Edit the list",
  submitText: "Edit",
  loadingText: "Editing...",
  successText: "Fight Club was updated.",
  errorText: "Something went wrong while editing the list.",
  refreshes: true,
});
