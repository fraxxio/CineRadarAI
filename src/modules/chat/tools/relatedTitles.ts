// get_recommendations and get_similar: TMDB lists that hang off one title
import { z } from "zod/v4";
import type { MediaType, Paged, TitleHit } from "@/infra/tmdb";
import { getGenres, type FetchOptions } from "@/infra/tmdb/server";
import { TITLE_ITEM_FIELDS, mediaTypeArg, toTitleItems } from "./shared";
import { defineTool } from "./types";

const MAX_RESULTS = 10;

type RelatedTitlesTool = {
  name: string;
  // completes "List released movies or TV shows ..."
  lists: string;
  // when to call it, after the result fields
  usage: string;
  status: string;
  fetch(
    type: MediaType,
    id: number,
    options: FetchOptions,
  ): Promise<Paged<TitleHit>>;
};

export const relatedTitlesTool = ({
  name,
  lists,
  usage,
  status,
  fetch,
}: RelatedTitlesTool) =>
  defineTool({
    name,
    description: `List released movies or TV shows ${lists}; returns the top ${MAX_RESULTS} with ${TITLE_ITEM_FIELDS}. ${usage}`,
    status,
    args: z.object({
      type: mediaTypeArg,
      id: z
        .number()
        .int()
        .min(1)
        .describe("TMDB id of the title, from the same result as its type"),
    }),
    async run({ type, id }, { signal }) {
      const [page, genres] = await Promise.all([
        fetch(type, id, { signal }),
        // genres are extra detail: a title still counts without them
        getGenres(type, { signal }).catch(() => []),
      ]);
      return {
        results: toTitleItems(
          type,
          // the title itself isn't a suggestion
          page.results.filter((hit) => hit.id !== id),
          genres,
          MAX_RESULTS,
        ),
      };
    },
  });
