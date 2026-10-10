import { z } from "zod/v4";
import type { CastCredit, CrewCredit, MediaType, TitleHit } from "@/infra/tmdb";
import { getGenres, getPersonCredits as getCredits } from "@/infra/tmdb/server";
import {
  isReleased,
  mediaTypeArg,
  personIdArg,
  toTitleItem,
  today,
} from "./shared";
import { defineTool } from "./types";

const MAX_RESULTS = 20;

// documentaries, award shows and the like: the person plays themselves
const SELF_APPEARANCE = /^(self|himself|herself)\b/i;
// TMDB TV genre ids of Talk and News: guest spots there aren't "shows with
// <actor>"
const TALK_AND_NEWS_GENRE_IDS = [10767, 10763];

// one credit per title, with the fields only this role has
type Entry = { hit: TitleHit; extra: object };

export const getPersonCredits = defineTool({
  name: "get_person_credits",
  description:
    'List the released movies or TV shows of a person from TMDB, most voted first; returns the top 20 with their TMDB id, title, release year, rating, vote count and genres, plus the character (cast) or jobs (crew). The id comes from search_person. For "directed by", use role "crew" and keep the titles whose jobs include "Director".',
  status: "Checking filmography...",
  args: z.object({
    id: personIdArg,
    type: mediaTypeArg,
    role: z
      .enum(["cast", "crew"])
      .default("cast")
      .describe("cast: acting credits, crew: jobs behind the camera"),
  }),
  async run({ id, type, role }, { signal }) {
    const [credits, genres] = await Promise.all([
      getCredits(type, id, { signal }),
      // genres are extra detail: a credit still counts without them
      getGenres(type, { signal }).catch(() => []),
    ]);
    const asOf = today();
    const entries =
      role === "cast"
        ? castEntries(type, credits.cast, asOf)
        : crewEntries(credits.crew, asOf);
    return {
      results: entries
        // votes as a proxy for the person's well-known titles
        .sort((a, b) => b.hit.voteCount - a.hit.voteCount)
        .slice(0, MAX_RESULTS)
        .map(({ hit, extra }) => ({
          ...toTitleItem(type, hit, genres),
          ...extra,
        })),
    };
  },
});

function castEntries(
  type: MediaType,
  cast: CastCredit[],
  asOf: string,
): Entry[] {
  const entries: Entry[] = [];
  for (const credit of cast) {
    const keep =
      isReleased(credit, asOf) &&
      !SELF_APPEARANCE.test(credit.character) &&
      !credit.genreIds.some((id) => TALK_AND_NEWS_GENRE_IDS.includes(id)) &&
      // two roles in one title are listed twice: keep the first
      !entries.some((entry) => entry.hit.id === credit.id);
    if (keep) {
      entries.push({
        hit: credit,
        extra: {
          character: credit.character,
          ...(type === "tv" ? { episodes: credit.episodeCount } : {}),
        },
      });
    }
  }
  return entries;
}

// TMDB lists a title once per job: one entry per title, its jobs merged
function crewEntries(crew: CrewCredit[], asOf: string): Entry[] {
  const byTitle = new Map<number, { hit: TitleHit; jobs: string[] }>();
  for (const credit of crew) {
    if (!isReleased(credit, asOf)) {
      continue;
    }
    const entry = byTitle.get(credit.id);
    if (!entry) {
      byTitle.set(credit.id, { hit: credit, jobs: [credit.job] });
    } else if (!entry.jobs.includes(credit.job)) {
      entry.jobs.push(credit.job);
    }
  }
  return Array.from(byTitle.values(), ({ hit, jobs }) => ({
    hit,
    extra: { jobs },
  }));
}
