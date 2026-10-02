import EditListBtn from "./EditListBtn";
import { describeListForm, LIST_ENTRY } from "../testing/listForm";

describeListForm({
  name: "EditListBtn",
  element: (user) => <EditListBtn user={user} {...LIST_ENTRY} />,
  trigger: "Edit list entry",
  dialogTitle: "Edit the list",
  submitText: "Edit",
  loadingText: "Editing...",
  successText: "Fight Club was updated.",
  errorText: "Something went wrong while editing the list.",
  refreshes: true,
});
