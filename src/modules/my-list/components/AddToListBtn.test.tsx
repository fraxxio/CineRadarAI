import AddToListBtn from "./AddToListBtn";
import { describeListForm, LIST_ENTRY } from "../testing/listForm";

describeListForm({
  name: "AddToListBtn",
  element: (user) => <AddToListBtn user={user} {...LIST_ENTRY} />,
  trigger: /add to list/i,
  dialogTitle: "Choose options to add to the list.",
  submitText: "Add to list",
  loadingText: "Adding...",
  successText: "Fight Club was added to the list.",
  errorText: "Something went wrong while adding to the list.",
  refreshes: false,
});
