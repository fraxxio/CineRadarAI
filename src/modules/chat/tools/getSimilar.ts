import { getSimilarTitles } from "@/infra/tmdb/server";
import { relatedTitlesTool } from "./relatedTitles";

export const getSimilar = relatedTitlesTool({
  name: "get_similar",
  lists: "TMDB finds similar to one title by genres and keywords",
  usage:
    'Use it for "something like <title>", in parallel with get_recommendations: take the id and type from the same tool result, because movie and TV ids overlap.',
  status: "Finding similar titles...",
  fetch: getSimilarTitles,
});
