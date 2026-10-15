import { z } from "zod/v4";
import type {
  CastCredit,
  CrewCredit,
  Genre,
  MediaType,
  TitleHit,
} from "@/infra/tmdb";
import { getGenres, getPersonCredits as getCredits } from "@/infra/tmdb/server";
import { today } from "../date";
import { isTalkOrNews } from "./genres";
import {
  TITLE_ITEM_FIELDS,
  isListable,
  mediaTypeArg,
  personIdArg,
  toTitleItem,
} from "./shared";
import { type ListStatuses, listStatuses } from "./userList";
import { ToolError, defineTool } from "./types";

const MAX_RESULTS = 20;

// documentaries, award shows and the like: the person plays themselves
const SELF_APPEARANCE = /^(self|himself|herself)\b/i;

// TMDB's crew departments
const DEPARTMENTS = [
  "Directing",
  "Writing",
  "Production",
  "Sound",
  "Camera",
  "Editing",
  "Art",
  "Costume & Make-Up",
  "Visual Effects",
  "Lighting",
  "Crew",
] as const;

// one credit per title, with the fields only this role has
type Entry<Extra> = { hit: TitleHit; extra: Extra };
type CastExtra = { character: string; episodes?: number | null };
type CrewExtra = { jobs: string[] };

export const getPersonCredits = defineTool({
  name: "get_person_credits",
  description: `List the released movies or TV shows of a person from TMDB, most voted first; returns the top ${MAX_RESULTS} with ${TITLE_ITEM_FIELDS}, plus the character (cast) or jobs (crew). The id comes from search_person. For "directed by", use role "crew" with department "Directing" and keep the titles whose jobs include "Director". TV cast also gets episodes: a few episodes in a long show is a guest role, not a main one.`,
  status: "Checking filmography...",
  args: z.object({
    id: personIdArg,
    type: mediaTypeArg,
    role: z
      .enum(["cast", "crew"])
      .default("cast")
      .describe("cast: acting credits, crew: jobs behind the camera"),
    // applied before the limit: a director's producer credits would
    // otherwise crowd out the films they directed
    department: z
      .enum(DEPARTMENTS)
      .optional()
      .describe(
        "Crew only: only the jobs in this department, e.g. Directing for directors, Writing for writers",
      ),
  }),
  async run({ id, type, role, department }, ctx) {
    const { signal } = ctx;
    if (role === "cast" && department) {
      throw new ToolError('department works with role "crew" only.');
    }
    const [credits, genres, listed] = await Promise.all([
      getCredits(type, id, { signal }),
      // genres are extra detail: a credit still counts without them
      getGenres(type, { signal }).catch(() => []),
      listStatuses(ctx),
    ]);
    const asOf = today();
    return {
      results:
        role === "cast"
          ? toItems(type, castEntries(type, credits.cast, asOf), genres, listed)
          : toItems(
              type,
              crewEntries(
                credits.crew.filter(
                  (credit) => !department || credit.department === department,
                ),
                asOf,
              ),
              genres,
              listed,
            ),
    };
  },
});

// the top entries as model items, with their role's fields
function toItems<Extra extends object>(
  type: MediaType,
  entries: Entry<Extra>[],
  genres: Genre[],
  listed: ListStatuses,
) {
  return (
    entries
      // votes as a proxy for the person's well-known titles
      .sort((a, b) => b.hit.voteCount - a.hit.voteCount)
      .slice(0, MAX_RESULTS)
      .map(({ hit, extra }) => ({
        ...toTitleItem(type, hit, genres, listed),
        ...extra,
      }))
  );
}

function castEntries(
  type: MediaType,
  cast: CastCredit[],
  asOf: string,
): Entry<CastExtra>[] {
  const entries: Entry<CastExtra>[] = [];
  const seen = new Set<number>();
  for (const credit of cast) {
    const keep =
      isListable(credit, asOf) &&
      !SELF_APPEARANCE.test(credit.character) &&
      // guest spots on talk and news shows aren't "shows with <actor>"
      !isTalkOrNews(credit) &&
      // two roles in one title are listed twice: keep the first
      !seen.has(credit.id);
    if (keep) {
      seen.add(credit.id);
      const extra: CastExtra = { character: credit.character };
      if (type === "tv") {
        extra.episodes = credit.episodeCount;
      }
      entries.push({ hit: credit, extra });
    }
  }
  return entries;
}

// TMDB lists a title once per job: one entry per title, its jobs merged.
// Talk and news shows stay: a crew credit there (e.g. producer) is real work
function crewEntries(crew: CrewCredit[], asOf: string): Entry<CrewExtra>[] {
  const byTitle = new Map<number, Entry<CrewExtra>>();
  for (const credit of crew) {
    if (!isListable(credit, asOf)) {
      continue;
    }
    const entry = byTitle.get(credit.id);
    if (!entry) {
      byTitle.set(credit.id, { hit: credit, extra: { jobs: [credit.job] } });
    } else if (!entry.extra.jobs.includes(credit.job)) {
      entry.extra.jobs.push(credit.job);
    }
  }
  return Array.from(byTitle.values());
}
