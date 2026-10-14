import type { StoredEntry } from "@/modules/my-list";
import type { ChatUser, ToolContext } from "../tools/types";
import { userList } from "../tools/userList";

type ToolContextOptions = {
  signal?: AbortSignal;
  user?: ChatUser;
  // the entries, or the test's own loader (e.g. a failing one)
  list?: StoredEntry[] | ToolContext["list"];
  invalidateList?: () => void;
};

// what the registry hands a tool; signed out unless the test needs a user.
// The list is read from the DB like in a turn, unless the test passes it
export function toolContext({
  signal = new AbortController().signal,
  user = { status: "signed_out" },
  list,
  invalidateList,
}: ToolContextOptions = {}): ToolContext {
  const turnList = userList(user);
  return {
    signal,
    user,
    list: Array.isArray(list)
      ? () => Promise.resolve(list)
      : list ?? turnList.list,
    invalidateList: invalidateList ?? turnList.invalidate,
  };
}

// a signed-in user whose list is these entries, or comes from this loader
export const listContext = (
  list: StoredEntry[] | ToolContext["list"],
  options: Omit<ToolContextOptions, "user" | "list"> = {},
) =>
  toolContext({
    ...options,
    user: { status: "signed_in", id: "user-1" },
    list,
  });
