import type { MediaType, TitleId } from "./types";

export const TMDB_SITE_URL = "https://www.themoviedb.org";

export type ImageSize = "w500" | "w780" | "w1280";

// null when TMDB has no image, so callers can show a placeholder
export function tmdbImageUrl(
  path: string | null | undefined,
  size: ImageSize,
): string | null {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export function tmdbWatchUrl(type: MediaType, id: TitleId): string {
  return `${TMDB_SITE_URL}/${type}/${id}/watch`;
}
