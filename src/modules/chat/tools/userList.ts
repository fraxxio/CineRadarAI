// the session user's list as the tools see it, read at most once per turn
// however many tools need it
import type { MediaType } from "@/infra/tmdb";
import type { StoredEntry } from "@/modules/my-list";
import { MAX_TITLE_LENGTH } from "@/shared/lib/titleKey";
import { listServer } from "../listServer";
import type { ChatUser, ToolContext } from "./types";

export type UserList = {
  // null when the user isn't signed in; rejects when the DB read fails
  list(): Promise<StoredEntry[] | null>;
  // after a save, so the next read sees it
  invalidate(): void;
};

// the read takes no signal: the calls of a round share it, so one call's
// timeout mustn't fail it for the others (see waitForList)
export function userList(user: ChatUser): UserList {
  let entries: Promise<StoredEntry[]> | undefined;
  return {
    list() {
      if (user.status !== "signed_in") {
        return Promise.resolve(null);
      }
      if (!entries) {
        const read = listServer().then(({ readEntries }) =>
          readEntries(user.id),
        );
        entries = read;
        // logged here, once per read, not by each call sharing it. A failed
        // read isn't kept, so the next call retries; a read replaced by
        // invalidate() stays replaced
        read.catch((error) => {
          console.error("Can't read the user's list:", error);
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

// a call's wait for the shared read: rejects when the call's signal aborts
// (its timeout or a Stop) or after `ms`, while the read goes on for the
// other calls. Without it, a hung DB would hang the round
export function waitForList(
  { list, signal }: Pick<ToolContext, "list" | "signal">,
  ms?: number,
): Promise<StoredEntry[] | null> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onAbort = () => settle(() => reject(signal.reason));
    const settle = (end: () => void) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      end();
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    if (ms !== undefined) {
      timer = setTimeout(
        () =>
          settle(() =>
            reject(new DOMException("List read timed out", "TimeoutError")),
          ),
        ms,
      );
    }
    list().then(
      (entries) => settle(() => resolve(entries)),
      (error) => settle(() => reject(error)),
    );
  });
}

// list names and statuses come from the add-to-list route, so they can be
// any text: keep them on one line and from closing a bracketed note
export const clean = (value: string) =>
  value
    .replace(/[[\]\s]+/g, " ")
    .trim()
    .slice(0, MAX_TITLE_LENGTH);

// the cleaned status of each title in the user's list; movie and TV ids
// overlap, so the key holds both
export type ListStatuses = ReadonlyMap<string, string>;

export const listedKey = (type: MediaType, id: number) => `${type}-${id}`;

// the marks are extra detail: a slow DB costs them, not the lookup
export const LIST_MARKS_TIMEOUT_MS = 2000;

// never rejects: a lookup still works without the marks. Empty when signed
// out
export async function listStatuses(ctx: ToolContext): Promise<ListStatuses> {
  try {
    const entries = (await waitForList(ctx, LIST_MARKS_TIMEOUT_MS)) ?? [];
    return new Map(
      entries.map((entry) => [
        listedKey(entry.type, entry.movieId),
        clean(entry.status),
      ]),
    );
  } catch (error) {
    // a failed read is logged by userList; an aborted call fails anyway
    if (
      !ctx.signal.aborted &&
      error instanceof DOMException &&
      error.name === "TimeoutError"
    ) {
      console.warn(
        `No inList marks: the list read took over ${LIST_MARKS_TIMEOUT_MS} ms`,
      );
    }
    return new Map();
  }
}
