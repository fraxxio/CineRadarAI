import { z } from "zod/v4";
import { searchPeople } from "@/infra/tmdb/server";
import { yearOf } from "./shared";
import { defineTool } from "./types";

const MAX_RESULTS = 5;
const MAX_KNOWN_FOR = 3;

export const searchPerson = defineTool({
  name: "search_person",
  description:
    "Search TMDB for a person (actor, director, writer...) by name. Returns the top 5 matches with their TMDB person id, main department and up to 3 titles they're known for. Use it to get the id for discover_titles (movies) or get_person_credits; when several people share a name, pick by department and knownFor.",
  status: "Searching people...",
  args: z.object({
    query: z.string().min(1).max(100).describe("The person's name"),
  }),
  async run({ query }, { signal }) {
    const page = await searchPeople(query, { signal });
    return {
      results: page.results.slice(0, MAX_RESULTS).map((person) => ({
        id: person.id,
        name: person.name,
        department: person.department,
        knownFor: person.knownFor
          .slice(0, MAX_KNOWN_FOR)
          .map(({ type, title, releaseDate }) => ({
            type,
            title,
            year: yearOf(releaseDate),
          })),
      })),
    };
  },
});
