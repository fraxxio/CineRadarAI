import { getRecommendations as fetchRecommendations } from "@/infra/tmdb/server";
import { relatedTitlesTool } from "./relatedTitles";

export const getRecommendations = relatedTitlesTool({
  name: "get_recommendations",
  lists: "TMDB recommends to fans of one title",
  usage:
    'Use it for "something like <title>": take the id and type from the same tool result, because movie and TV ids overlap. It is often empty for lesser-known titles, so call get_similar in parallel.',
  status: "Finding recommendations...",
  fetch: fetchRecommendations,
});
