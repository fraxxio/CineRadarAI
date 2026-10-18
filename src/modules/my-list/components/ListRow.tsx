import { ImageOff, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import ListEntryDialog from "./ListEntryDialog";
import RemoveEntryButton from "./RemoveEntryButton";
import StatusBadge from "./StatusBadge";
import type { StoredEntry } from "../entry";
import { tmdbImageUrl } from "@/infra/tmdb";

type ListRowProps = {
  movie: StoredEntry;
  // the first rows are above the fold
  priority?: boolean;
};

const TYPE_LABELS = { movie: "Movie", tv: "TV" } as const;

export default function ListRow({ movie, priority = false }: ListRowProps) {
  // entries saved without a poster or backdrop have an empty image; the
  // stored image is usually a backdrop, so the thumbnail is 16:9
  const thumbnail = tmdbImageUrl(movie.image, "w300");

  return (
    <li className="flex items-center gap-4 border-b border-border-clr px-8 py-2.5 last:border-none max-[480px]:items-start max-[480px]:gap-3 max-[480px]:px-4">
      <div className="aspect-video w-40 shrink-0 overflow-hidden rounded-sm border border-border-clr bg-slate-950 max-[480px]:w-28">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={movie.name}
            width={300}
            height={169}
            priority={priority}
            sizes="(max-width: 480px) 112px, 160px"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff aria-label="No image available" />
          </div>
        )}
      </div>
      {/* min-w-0 and overflow-wrap: anywhere let long titles wrap instead of
          pushing the actions or the row out */}
      <div className="flex min-w-0 flex-grow items-center justify-between gap-4 max-[480px]:flex-col max-[480px]:items-start max-[480px]:gap-2">
        <div className="flex min-w-0 flex-col items-start gap-1">
          <Link
            href={`/search/${movie.type}/${movie.movieId}`}
            className="text-lg font-medium [overflow-wrap:anywhere] hover:underline max-[480px]:text-base"
          >
            {movie.name}
          </Link>
          <p className="flex items-center gap-1 text-sm text-secondary-text">
            {TYPE_LABELS[movie.type]} ·{" "}
            {movie.rating === 0 ? (
              "Not rated"
            ) : (
              <span className="flex items-center gap-1 text-yellow-500">
                <Star size={14} fill="currentColor" aria-label="Rating" />
                {movie.rating}
              </span>
            )}
          </p>
          <StatusBadge status={movie.status} />
        </div>
        <div className="flex shrink-0 gap-2">
          {/* the list page is only shown to signed-in users */}
          <ListEntryDialog
            mode="edit"
            signedIn
            movieId={movie.movieId}
            title={movie.name}
            image={movie.image}
            type={movie.type}
            status={movie.status}
            rating={movie.rating}
          />
          <RemoveEntryButton
            movieId={movie.movieId}
            title={movie.name}
            type={movie.type}
          />
        </div>
      </div>
    </li>
  );
}
