// the session user's list, read at most once per turn however many tools
// need it
import type { StoredEntry } from "@/modules/my-list";
import { listServer } from "../listServer";
import type { ChatUser } from "./types";

export type UserList = {
  // null when the user isn't signed in; rejects when the DB read fails
  list(): Promise<StoredEntry[] | null>;
  // after a save, so the next read sees it
  invalidate(): void;
};

// the read takes no signal: the calls of a round share it, so one call's
// timeout mustn't fail it for the others
export function userList(user: ChatUser): UserList {
  let entries: Promise<StoredEntry[]> | undefined;
  return {
    list() {
      if (user.status !== "signed_in") {
        return Promise.resolve(null);
      }
      if (!entries) {
        const read = listServer().then(({ getEntries }) => getEntries(user.id));
        entries = read;
        // a failed read isn't kept, so the next call retries; a read
        // replaced by invalidate() stays replaced
        read.catch(() => {
          if (entries === read) {
            entries = undefined;
          }
        });
      }
      return entries;
    },
    invalidate() {
      entries = undefined;
    },
  };
}
