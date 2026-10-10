// one genre enum for the tool args, mapped to TMDB's per-type genre lists
import { z } from "zod/v4";
import type { Genre, MediaType } from "@/infra/tmdb";
import { ToolError } from "./types";

// one list for movies and TV; TMDB's TV list merges some genres
export const GENRE_NAMES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Kids",
  "Music",
  "Mystery",
  "Reality",
  "Romance",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
] as const;

export type GenreName = (typeof GENRE_NAMES)[number];

export const genreArg = z.enum(GENRE_NAMES);

// for tool descriptions: excluding or filtering one half of a merged TV genre
// hits the other half too
export const TV_GENRE_NOTE =
  "On TV, Action and Adventure are one genre, so are Science Fiction and Fantasy, and War includes Politics.";

// the TMDB genre name per type; null when the type has no equivalent
const TMDB_GENRE: Record<GenreName, Record<MediaType, string | null>> = {
  Action: { movie: "Action", tv: "Action & Adventure" },
  Adventure: { movie: "Adventure", tv: "Action & Adventure" },
  Animation: { movie: "Animation", tv: "Animation" },
  Comedy: { movie: "Comedy", tv: "Comedy" },
  Crime: { movie: "Crime", tv: "Crime" },
  Documentary: { movie: "Documentary", tv: "Documentary" },
  Drama: { movie: "Drama", tv: "Drama" },
  Family: { movie: "Family", tv: "Family" },
  Fantasy: { movie: "Fantasy", tv: "Sci-Fi & Fantasy" },
  History: { movie: "History", tv: null },
  Horror: { movie: "Horror", tv: null },
  Kids: { movie: null, tv: "Kids" },
  Music: { movie: "Music", tv: null },
  Mystery: { movie: "Mystery", tv: "Mystery" },
  Reality: { movie: null, tv: "Reality" },
  Romance: { movie: "Romance", tv: null },
  "Science Fiction": { movie: "Science Fiction", tv: "Sci-Fi & Fantasy" },
  Thriller: { movie: "Thriller", tv: null },
  War: { movie: "War", tv: "War & Politics" },
  Western: { movie: "Western", tv: "Western" },
};

const TYPE_LABEL: Record<MediaType, string> = { movie: "movie", tv: "TV" };

// the enum names that work for a type
export const genreNamesFor = (type: MediaType) =>
  GENRE_NAMES.filter((name) => TMDB_GENRE[name][type] !== null);

// enum names -> TMDB ids for a type, without duplicates (Action + Adventure
// are one TV genre)
export function resolveGenreIds(
  type: MediaType,
  names: readonly GenreName[],
  genreList: Genre[],
): number[] {
  // checked first: the model can fix these, a renamed genre it can't
  const unsupported = names.find((name) => TMDB_GENRE[name][type] === null);
  if (unsupported) {
    const label = TYPE_LABEL[type];
    throw new ToolError(
      `"${unsupported}" isn't a TMDB ${label} genre. Valid ${label} genres: ${genreNamesFor(type).join(", ")}`,
    );
  }

  const ids = names.map((name) => {
    const tmdbName = TMDB_GENRE[name][type];
    const genre = genreList.find((g) => g.name === tmdbName);
    // TMDB renamed a genre: fail loudly rather than drop the filter
    if (!genre) {
      throw new Error(`TMDB ${type} genre list has no "${tmdbName}"`);
    }
    return genre.id;
  });
  return ids.filter((id, i) => ids.indexOf(id) === i);
}
