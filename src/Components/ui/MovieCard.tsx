import { Star } from "lucide-react";
import Image from "next/image";

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
    title: string;
    video: boolean;
    vote_average: number;
    vote_count: number;
  };
};

export default function MovieCard({
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
    title,
    video,
    vote_average,
    vote_count,
  },
}: MovieCardProps) {
  return (
    <div className="relative w-full border border-border-clr bg-primary-bg duration-300 hover:border-primary-text hover:shadow-md hover:shadow-primary-text">
      <Image
        src={`https://image.tmdb.org/t/p/w500${poster_path}`}
        alt={title}
        width={150}
        height={150}
        className="h-[80%] w-full border-b border-border-clr object-cover"
        sizes="(max-width: 768px) 100vw, 33vw"
      />
      <div className="flex h-[20%] flex-col justify-between p-2">
        <div className="relative flex justify-between">
          <h1
            title={title}
            className="max-w-[60%] truncate text-xl font-medium"
          >
            {title}
          </h1>
          <p className="text-sm">{release_date}</p>
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
    </div>
  );
}
