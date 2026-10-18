import { BookmarkCheck, ImageOff, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ListEntryDialog, type ListStatus } from "@/modules/my-list";
import { tmdbImageUrl } from "@/infra/tmdb";
import type { RecommendedTitle } from "./protocol";

type RecommendationCardProps = {
  title: RecommendedTitle;
  signedIn: boolean;
  // after a save from this chat; null or undefined: no badge
  listStatus?: ListStatus | null;
};

// a compact row: poster on the left, TMDB details and the model's reason on the right
export function RecommendationCard({
  title: {
    type,
    id,
    title,
    year,
    rating,
    genres,
    posterPath,
    backdropPath,
    reason,
  },
  signedIn,
  listStatus,
}: RecommendationCardProps) {
  const href = `/search/${type}/${id}`;
  const poster = tmdbImageUrl(posterPath || backdropPath, "w342");

  return (
    <div className="relative flex h-full border border-border-clr bg-primary-bg duration-300 hover:border-primary-text hover:shadow-md hover:shadow-primary-text">
      {/* the title is the card's one link for screen readers and keyboards */}
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        className="w-24 shrink-0 max-[380px]:w-20"
      >
        {poster === null ? (
          <div className="flex aspect-[2/3] h-full w-full items-center justify-center border-r border-border-clr bg-slate-950">
            <ImageOff aria-label="No image available" />
          </div>
        ) : (
          <Image
            src={poster}
            alt={title}
            width={96}
            height={144}
            sizes="96px"
            className="aspect-[2/3] h-full w-full border-r border-border-clr object-cover"
          />
        )}
      </Link>
      {/* min-w-0 and break-words keep long words from widening the chat on
          mobile */}
      <div className="flex min-w-0 flex-col gap-1 p-3">
        {/* pr-10 and the min height keep the text below clear of the corner
            button, the rest of the card gets the full width */}
        <h2 className="min-h-[2.5rem] break-words pr-10">
          <Link href={href} className="text-lg font-medium hover:underline">
            {title}
          </Link>
        </h2>
        <p className="text-sm text-secondary-text">
          {year ?? "Unknown year"} · {type === "movie" ? "Movie" : "TV show"}
        </p>
        <p className="flex items-center gap-1 text-sm">
          <Star size={16} />
          {rating === null ? "Not rated" : `${rating.toFixed(1)} / 10`}
        </p>
        {genres.length > 0 && <p className="text-sm">{genres.join(" · ")}</p>}
        {listStatus && (
          <p className="flex items-center gap-1 text-sm font-medium">
            <BookmarkCheck size={16} className="shrink-0" aria-hidden />
            In your list · {listStatus}
          </p>
        )}
        <p className="break-words">{reason}</p>
      </div>
      <ListEntryDialog
        signedIn={signedIn}
        movieId={id}
        title={title}
        image={backdropPath || posterPath || ""}
        type={type}
      />
    </div>
  );
}
