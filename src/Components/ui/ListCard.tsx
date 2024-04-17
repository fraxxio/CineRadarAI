import { CircleCheck, Eye, NotebookPen, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import EditListBtn from "./EditListBtn";
import DeleteListBtn from "./DeleteListBtn";

type ListCardProps = {
  movie: {
    image: string;
    name: string;
    movieId: number;
    rating: number;
    status: string;
    type: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    image: string;
  };
  index: number;
};

export default function ListCard({ movie, index, user }: ListCardProps) {
  return (
    <div className="relative flex gap-8 border-b border-border-clr last:border-none">
      <Image
        src={`https://image.tmdb.org/t/p/w500${movie.image}`}
        alt={movie.name}
        width={400}
        height={400}
        className="max-h-[225px] border-r border-border-clr object-cover"
        sizes="(max-width: 768px) 100vw, 33vw"
      />
      <div className="flex flex-grow justify-between py-4 pr-8">
        <div>
          <Link
            href={`/search/${movie.type}/${movie.movieId}`}
            className="text-2xl font-medium hover:underline"
          >
            {movie.name}
          </Link>
          <div className="flex items-center gap-4 pt-4 text-lg">
            <p>Rating: </p>
            {movie.rating === 0 ? (
              <p>Not rated</p>
            ) : (
              <div className="flex items-center gap-1 text-yellow-500">
                <Star size={20} />
                <p>{movie.rating}</p>
              </div>
            )}
          </div>
          <p>
            Type: {movie.type.charAt(0).toUpperCase() + movie.type.slice(1)}
          </p>
          <div className="flex items-center gap-4 pt-8 text-lg">
            <p>Status: </p>
            <div className="flex items-center gap-1">
              {movie.status === "Watching" ? (
                <Eye size={20} />
              ) : movie.status === "Completed" ? (
                <CircleCheck size={20} />
              ) : (
                <NotebookPen size={20} />
              )}
              <p>{movie.status}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end justify-between gap-4">
          <p className=" text-lg text-secondary-text">#{index + 1}</p>
          <EditListBtn
            user={user}
            movieId={movie.movieId}
            title={movie.name}
            image={movie.image}
            type={movie.type}
          />
          <DeleteListBtn
            userId={user.id}
            movieId={movie.movieId}
            title={movie.name}
          />
        </div>
      </div>
    </div>
  );
}
