import { Star } from "lucide-react";
import Image from "next/image";
import { NoImage } from "./NoImage";
import Link from "next/link";
import { AddToListBtn } from "@/modules/my-list";
import { getSession } from "@/infra/auth/session";
import { tmdbImageUrl, type MediaType, type TitleSummary } from "@/infra/tmdb";

type MovieCardProps = {
  movie: TitleSummary;
  type: MediaType;
};

export default async function MovieCard({
  movie: {
    id,
    title,
    releaseDate,
    posterPath,
    backdropPath,
    voteAverage,
    voteCount,
  },
  type,
}: MovieCardProps) {
  const poster = tmdbImageUrl(posterPath || backdropPath, "w500");
  const session = await getSession();
  return (
    <div className="relative w-full border border-border-clr bg-primary-bg duration-300 hover:border-primary-text hover:shadow-md hover:shadow-primary-text">
      <AddToListBtn
        user={session?.user}
        movieId={id}
        title={title}
        image={backdropPath || posterPath || ""}
        type={type}
      />
      <Link href={`/search/${type}/${id}`}>
        {poster === null ? (
          <NoImage title={title} />
        ) : (
          <Image
            src={poster}
            alt={title}
            width={150}
            height={150}
            className="h-[30rem] w-full border-b border-border-clr object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        )}
        <div className="flex h-[6.5rem] flex-col justify-between p-2">
          <div className="flex justify-between">
            <h1
              title={title}
              className="max-w-[60%] truncate text-xl font-medium"
            >
              {title}
            </h1>
            <p className="text-sm">{releaseDate}</p>
          </div>
          <div className="flex justify-between">
            <div className="flex items-center gap-1">
              <Star size={16} />
              <p className="text-sm font-medium">
                {voteAverage.toFixed(1)} / 10
              </p>
            </div>
            <p>Votes: {voteCount}</p>
          </div>
        </div>
      </Link>
    </div>
  );
}
