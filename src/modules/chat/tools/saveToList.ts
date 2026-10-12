import { z } from "zod/v4";
import type { ListStatus } from "@/modules/my-list";
import { mediaTypeArg } from "./shared";
import { DisplayOutput, ToolError, defineTool } from "./types";

export const SAVE_TO_LIST = "save_to_list";
const MAX_TITLE_LENGTH = 300;

// loaded when a save runs, not with the schema: the list's server code needs
// the DB client and React's cache, which scripts/check-chat-tools.ts can't
// load (and LIST_STATUSES comes only through it or the components)
const listServer = () => import("@/modules/my-list/server");
type ListServer = Awaited<ReturnType<typeof listServer>>;

// LIST_STATUSES' values, in its order; an extra value fails `satisfies`, a
// missing one the check below
const STATUSES = [
  "Planning to watch",
  "Completed",
  "Watching",
] as const satisfies readonly ListStatus[];
type MissingStatus = Exclude<ListStatus, (typeof STATUSES)[number]>;
const statusesComplete: [MissingStatus] extends [never] ? true : never = true;

// the same reasons show_recommendations gives for a title it leaves out
const rejectionMessage = (
  { rejection }: InstanceType<ListServer["SaveTitleError"]>,
  title: string,
) => {
  switch (rejection.reason) {
    case "not_found":
      return "not found on TMDB";
    case "not_available":
      return "not available";
    case "title_mismatch":
      return `the id is "${rejection.tmdbTitle}", not "${title}"`;
  }
};

// a title that can't be saved is the model's mistake; a failed TMDB request
// goes to the registry like any failed lookup
async function withList<T>(
  run: (list: ListServer) => Promise<T>,
  title: string,
) {
  const list = await listServer();
  try {
    return await run(list);
  } catch (error) {
    if (error instanceof list.SaveTitleError) {
      throw new ToolError(rejectionMessage(error, title));
    }
    throw error;
  }
}

export const saveToList = defineTool({
  name: SAVE_TO_LIST,
  description:
    "Save a title to the user's own list, or change its status there. Works only for the signed-in user. Returns the title as saved with its status, and its previous status (null when it wasn't in the list); or saved: false when the user isn't signed in.",
  status: "Saving to your list...",
  args: z.object({
    type: mediaTypeArg,
    id: z
      .number()
      .int()
      .min(1)
      .describe(
        "TMDB id of the title, exactly as a tool returned it in this conversation",
      ),
    title: z
      .string()
      .min(1)
      .max(MAX_TITLE_LENGTH)
      .describe("Title of that id, exactly as the tool returned it"),
    status: z
      .enum(STATUSES)
      .optional()
      .describe(
        "Omit to add a new title as Planning to watch, or to leave a title already in the list as it is",
      ),
  }),
  async run(args, { signal, user }) {
    const { type, id, status } = args;
    switch (user.status) {
      // no TMDB request: nothing could be saved anyway
      case "unavailable":
        throw new ToolError("Can't save right now, try again later");

      // not an error: an error result makes the model say it can't look
      // titles up; the lookup makes sure the sign-in card is a real title
      case "signed_out": {
        const details = await withList(
          (list) => list.checkTitle(args, { signal }),
          args.title,
        );
        return new DisplayOutput(
          {
            saved: false,
            reason:
              "The user isn't signed in. The chat shows them a sign-in button for this title.",
          },
          [
            {
              type: "sign_in_required",
              save: {
                type,
                id,
                title: details.title,
                posterPath: details.posterPath,
                status: status ?? null,
              },
            },
          ],
        );
      }

      case "signed_in": {
        const { entry, previous } = await withList(
          (list) => list.saveTitle(user.id, args, { signal }),
          args.title,
        );
        return new DisplayOutput(
          {
            saved: { id, type, title: entry.title, status: entry.status },
            previousStatus: previous?.status ?? null,
          },
          [{ type: "list_saved", entry, previous }],
        );
      }
    }
  },
});
