import type { StoredEntry } from "@/modules/my-list";
import type { ChatUser, ToolContext } from "../tools/types";
import { userList } from "../tools/userList";

// what the registry hands a tool; signed out unless the test needs a user.
// The list is read from the DB like in a turn, unless the test passes the
// entries or its own loader (e.g. a failing one)
export const toolContext = (
  signal = new AbortController().signal,
  user: ChatUser = { status: "signed_out" },
  list: StoredEntry[] | ToolContext["list"] = userList(user).list,
): ToolContext => ({
  signal,
  user,
  list: Array.isArray(list) ? () => Promise.resolve(list) : list,
});
