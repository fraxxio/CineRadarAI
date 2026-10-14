import { z } from "zod/v4";
import type { StoredEntry } from "@/modules/my-list";
import { clean } from "./shared";
import { ToolError, defineTool } from "./types";

export const GET_MY_LIST = "get_my_list";

// keeps a long list's result small; the best signals of taste go first
export const MAX_LIST_TITLES = 50;

const UNAVAILABLE = "Can't read the list right now, try again later";

// unrated titles by how much they say about taste; old statuses last
const UNRATED_ORDER: readonly string[] = [
  "Completed",
  "Watching",
  "Planning to watch",
];
const unratedRank = (status: string) => {
  const rank = UNRATED_ORDER.indexOf(status);
  return rank === -1 ? UNRATED_ORDER.length : rank;
};

// rated titles highest first, then unrated ones by status
const byTaste = (a: StoredEntry, b: StoredEntry) =>
  b.rating - a.rating ||
  (a.rating ? 0 : unratedRank(a.status) - unratedRank(b.status));

export const getMyList = defineTool({
  name: GET_MY_LIST,
  description: `Get the signed-in user's own list: each title's type, TMDB id, title, status and the user's own rating (1-10, null when not rated). A long list is cut to ${MAX_LIST_TITLES} titles: rated ones highest first, then unrated Completed, Watching and Planning to watch ones. Returns signedIn: false when the user isn't signed in.`,
  status: "Reading your list...",
  args: z.object({}),
  async run(_, { user, list }) {
    switch (user.status) {
      case "unavailable":
        throw new ToolError(UNAVAILABLE);

      // not an error: an error result makes the model say it can't look
      // titles up
      case "signed_out":
        return {
          signedIn: false,
          reason: "The user isn't signed in, so their list can't be read.",
        };

      case "signed_in": {
        let entries: StoredEntry[];
        try {
          entries = (await list()) ?? [];
        } catch (error) {
          console.error("Can't read the list:", error);
          throw new ToolError(UNAVAILABLE);
        }
        // the list is oldest first and sort() is stable, so ties go newest
        // first
        const titles = [...entries]
          .reverse()
          .sort(byTaste)
          .slice(0, MAX_LIST_TITLES)
          .map(({ type, movieId, name, status, rating }) => ({
            type,
            id: movieId,
            title: clean(name),
            status: clean(status),
            rating: rating || null,
          }));
        return {
          total: entries.length,
          omitted: entries.length - titles.length,
          titles,
        };
      }
    }
  },
});
