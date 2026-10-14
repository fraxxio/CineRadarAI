import type { ChatUser, ToolContext } from "../tools/types";

// what the registry hands a tool; signed out unless the test needs a user
export const toolContext = (
  signal = new AbortController().signal,
  user: ChatUser = { status: "signed_out" },
): ToolContext => ({ signal, user });
