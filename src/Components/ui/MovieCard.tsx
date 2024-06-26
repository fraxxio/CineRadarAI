import { Star } from "lucide-react";
import Image from "next/image";
import { NoImage } from "./NoImage";
import Link from "next/link";
import AddToListBtn from "./AddToListBtn";
import { auth } from "@/auth";

type MovieCardProps = {
  movie: {
    adult: boolean;
    backdrop_path: string;
    genre_ids: Array<number>;
    id: number;
    original_language: string;
    original_title: string;
    overview: string;
    popularity: number;
    poster_path: string;
    release_date: string;
    first_air_date: string;
    title: string;
    name: string;
    video: boolean;
    vote_average: number;
    vote_count: number;
  };
  type: "movie" | "tv" | undefined;
};

export default async function MovieCard({
  movie: {
    adult,
    backdrop_path,
    genre_ids,
    id,
    original_language,
    original_title,
    overview,
    popularity,
    poster_path,
    release_date,
    first_air_date,
    title,
    name,
    video,
    vote_average,
    vote_count,
  },
  type,
}: MovieCardProps) {
  const session = await auth();
  return (
    <div className="relative w-full border border-border-clr bg-primary-bg duration-300 hover:border-primary-text hover:shadow-md hover:shadow-primary-text">
      <AddToListBtn
        user={session?.user}
        movieId={id}
        title={name || title}
        image={backdrop_path || poster_path}
        type={type!}
      />
      <Link href={`/search/${type}/${id}`}>
        {poster_path === null && backdrop_path === null ? (
          <NoImage title={title} />
        ) : (
          <Image
            src={`https://image.tmdb.org/t/p/w500${poster_path || backdrop_path}`}
            alt={title || name}
            width={150}
            height={150}
            className="h-[30rem] w-full border-b border-border-clr object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        )}
        <div className="flex h-[6.5rem] flex-col justify-between p-2">
          <div className="flex justify-between">
            <h1
              title={title || name}
              className="max-w-[60%] truncate text-xl font-medium"
            >
              {title || name}
            </h1>
            <p className="text-sm">{release_date || first_air_date}</p>
          </div>
          <div className="flex justify-between">
            <div className="flex items-center gap-1">
              <Star size={16} />
              <p className="text-sm font-medium">
                {vote_average.toFixed(1)} / 10
              </p>
            </div>
            <p>Votes: {vote_count}</p>
          </div>
        </div>
      </Link>
    </div>
  );
}
