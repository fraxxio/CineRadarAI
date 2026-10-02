import {
  CircleCheck,
  Eye,
  ImageOff,
  NotebookPen,
  Star,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import ListEntryDialog from "./ListEntryDialog";
import RemoveEntryButton from "./RemoveEntryButton";
import type { ListEntry, ListStatus } from "../entry";
import { tmdbImageUrl } from "@/infra/tmdb";

type ListCardProps = {
  movie: ListEntry;
  index: number;
};

const STATUS_ICONS: Record<ListStatus, LucideIcon> = {
  "Planning to watch": NotebookPen,
  Completed: CircleCheck,
  Watching: Eye,
};

export default function ListCard({ movie, index }: ListCardProps) {
  // entries saved without a poster or backdrop have an empty image
  const poster = tmdbImageUrl(movie.image, "w500");
  // rows saved before the payload was validated can hold other statuses
  const StatusIcon = STATUS_ICONS[movie.status] ?? NotebookPen;

  return (
    <div className="relative flex gap-8 border-b border-border-clr last:border-none max-[480px]:flex-col max-[480px]:gap-0">
      {poster ? (
        <Image
          src={poster}
          alt={movie.name}
          width={400}
          height={400}
          className="max-h-[225px] border-r border-border-clr object-cover max-[840px]:max-w-[250px] max-[567px]:max-w-[180px] max-[480px]:w-full max-[480px]:max-w-full max-[480px]:border-b max-[480px]:border-r-0"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
      ) : (
        <div className="flex h-[225px] w-[400px] shrink-0 flex-col items-center justify-center gap-2 border-r border-border-clr bg-slate-950 max-[840px]:w-[250px] max-[567px]:w-[180px] max-[480px]:w-full max-[480px]:border-b max-[480px]:border-r-0">
          <ImageOff aria-label="No image available" />
          <p>No image</p>
        </div>
      )}
      <div className="flex flex-grow justify-between py-4 pr-8 max-[610px]:flex-col max-[480px]:px-4">
        <div>
          <Link
            href={`/search/${movie.type}/${movie.movieId}`}
            className="text-2xl font-medium hover:underline max-[840px]:text-xl"
          >
            {movie.name}
          </Link>
          <div className="flex items-center gap-4 pt-4 text-lg max-[840px]:text-base">
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
          <div className="flex items-center gap-4 pt-8 text-lg max-[840px]:text-base">
            <p>Status: </p>
            <div className="flex items-center gap-1">
              <StatusIcon size={20} />
              <p>{movie.status}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end justify-between gap-4 max-[610px]:flex-row-reverse max-[610px]:pt-4">
          <p className=" text-lg text-secondary-text">#{index + 1}</p>
          {/* the list page is only shown to signed-in users */}
          <ListEntryDialog
            mode="edit"
            signedIn
            movieId={movie.movieId}
            title={movie.name}
            image={movie.image}
            type={movie.type}
          />
          <RemoveEntryButton
            movieId={movie.movieId}
            title={movie.name}
            type={movie.type}
          />
        </div>
      </div>
    </div>
  );
}
