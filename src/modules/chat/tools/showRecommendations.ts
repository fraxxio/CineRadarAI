import { z } from "zod/v4";
import type { MediaType } from "@/infra/tmdb";
import { TmdbError, getTitle } from "@/infra/tmdb/server";
import { matchesTitle } from "@/shared/lib/titleKey";
import { today } from "../date";
import type { RecommendedTitle } from "../protocol";
import { isReleased, mediaTypeArg, roundRating, yearOf } from "./shared";
import { DisplayOutput, defineTool } from "./types";

export const SHOW_RECOMMENDATIONS = "show_recommendations";
const MAX_ITEMS = 10;
const MAX_TITLE_LENGTH = 300;
const MAX_REASON_LENGTH = 200;

type NotShown = { id: number; type: MediaType; reason: string };

const isNotFound = (error: unknown) =>
  error instanceof TmdbError && error.status === 404;

export const showRecommendations = defineTool({
  name: SHOW_RECOMMENDATIONS,
  description:
    "Show the recommended titles to the user as cards with poster, year, rating and genres from TMDB. This is the only way to show recommendations: call it once per answer with every title, in the order you recommend them. Returns the titles shown, with their position, and the ones left out.",
  status: "Preparing recommendations...",
  args: z.object({
    items: z
      .array(
        z.object({
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
          reason: z
            .string()
            .min(1)
            .max(MAX_REASON_LENGTH)
            .describe("One sentence on why it fits, in the user's language"),
        }),
      )
      .min(1)
      .max(MAX_ITEMS),
  }),
  async run({ items }, { signal }) {
    const notShown: NotShown[] = [];
    const seen = new Set<string>();
    const unique = items.filter((item) => {
      const key = `${item.type}-${item.id}`;
      if (seen.has(key)) {
        notShown.push({ id: item.id, type: item.type, reason: "listed twice" });
        return false;
      }
      seen.add(key);
      return true;
    });

    const lookups = await Promise.allSettled(
      unique.map((item) => getTitle(item.type, item.id, { signal })),
    );
    if (signal.aborted) {
      throw signal.reason;
    }

    const asOf = today();
    const cards: RecommendedTitle[] = [];
    unique.forEach((item, i) => {
      const lookup = lookups[i];
      const leaveOut = (reason: string) =>
        notShown.push({ id: item.id, type: item.type, reason });
      if (lookup.status === "rejected") {
        leaveOut(
          isNotFound(lookup.reason)
            ? "not found on TMDB"
            : "couldn't be checked",
        );
        return;
      }
      const title = lookup.value;
      // like the lookup tools, which list no adult titles; the title isn't
      // named, so the model can't repeat it
      if (title.adult) {
        leaveOut("not available");
        return;
      }
      // a real id of another title would show a card that doesn't match the
      // reason
      if (!matchesTitle(item.title, title)) {
        leaveOut(`the id is "${title.title}", not "${item.title}"`);
        return;
      }
      if (!isReleased(title.releaseDate, asOf)) {
        leaveOut("not released yet");
        return;
      }
      cards.push({
        type: item.type,
        id: item.id,
        title: title.title,
        year: yearOf(title.releaseDate),
        rating: title.voteCount ? roundRating(title.voteAverage) : null,
        genres: title.genres.map((genre) => genre.name),
        posterPath: title.posterPath,
        backdropPath: title.backdropPath,
        reason: item.reason,
      });
    });

    // every lookup failed, so TMDB is down: the registry reports it like any
    // failed lookup; 404s alone return no cards, so the model can search again
    const failures = lookups.flatMap((lookup) =>
      lookup.status === "rejected" && !isNotFound(lookup.reason)
        ? [lookup.reason]
        : [],
    );
    if (failures.length === lookups.length) {
      throw failures[0];
    }

    return new DisplayOutput(
      {
        // what the user sees, in order: "the second one" is position 2
        shown: cards.map((card, i) => ({
          position: i + 1,
          id: card.id,
          type: card.type,
          title: card.title,
          year: card.year,
        })),
        notShown,
      },
      cards.length ? [{ type: "cards", items: cards }] : [],
    );
  },
});
