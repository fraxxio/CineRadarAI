import type { MediaType, TitleId } from "./types";

export type ImageSize = "w500" | "w780" | "w1280";

// null when TMDB has no image, so callers can show a placeholder
export function tmdbImageUrl(
  path: string | null | undefined,
  size: ImageSize,
): string | null {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export function tmdbWatchUrl(type: MediaType, id: TitleId): string {
  return `https://www.themoviedb.org/${type}/${id}/watch`;
}
