import Image from "next/image";
import { formatCurrency } from "./formatCurrency";
import {
  Clapperboard,
  Film,
  ImageOff,
  Images,
  MessageCircleMore,
  Star,
} from "lucide-react";
import { ListEntryDialog } from "@/modules/my-list";
import { getSession } from "@/infra/auth/session";
import { tmdbImageUrl, tmdbWatchUrl, type MediaType } from "@/infra/tmdb";
import { getTitle } from "@/infra/tmdb/server";

export default async function Details({
  mediaType,
  id,
}: {
  id: number;
  mediaType: MediaType;
}) {
  const details = await getTitle(mediaType, id);
  const {
    title,
    posterPath,
    backdropPath,
    overview,
    releaseDate,
    genres,
    voteAverage,
    voteCount,
    status,
  } = details;
  const poster = tmdbImageUrl(posterPath || backdropPath, "w500");
  const session = await getSession();

  return (
    <section className="mt-20 flex gap-32 rounded-sm border border-border-clr bg-primary-bg max-[950px]:flex-col max-[950px]:gap-4">
      {poster ? (
        <Image
          src={poster}
          alt={title}
          width={650}
          height={366}
          className="w-[30%] border-b border-border-clr object-cover max-[950px]:max-h-[30rem] max-[950px]:w-full"
          sizes="(min-width: 2120px) 400px, (min-width: 960px) calc(18.33vw + 15px), calc(100vw - 66px)"
          priority
        />
      ) : (
        <div className="w-full max-w-[30%] border-r border-border-clr pt-20 max-[950px]:max-h-[30rem] max-[950px]:w-full">
          <ImageOff className="mx-auto" />
          <p className="text-md text-center text-lg">No poster.</p>
        </div>
      )}
      <div className="items-startp-4 my-auto p-8">
        <div className="flex items-end justify-between max-[930px]:flex-col max-[930px]:items-start">
          <h1 className="max-w-[35rem] text-3xl font-medium max-[930px]:text-xl">
            {title}
          </h1>
          <p className="pb-1 max-[930px]:text-sm">
            {status}:{" "}
            {details.mediaType === "movie" ? releaseDate : details.lastAirDate}
          </p>
        </div>
        <p className=" pt-4 text-lg text-secondary-text max-[930px]:text-[1rem]">
          {overview}
        </p>
        <div className="flex flex-wrap gap-2 pt-4">
          {genres.map((genre) => {
            return (
              <p
                key={genre.id}
                className="rounded-md border border-border-clr bg-dark-bg px-2 py-1 font-medium text-secondary-text"
              >
                {genre.name}
              </p>
            );
          })}
        </div>
        <div className="flex flex-wrap justify-between gap-4 py-8 text-lg">
          <div className="flex items-center gap-2 text-yellow-600">
            <Star size={18} />
            <p>
              {voteAverage.toFixed(1)} / {voteCount}
            </p>
          </div>
          {details.mediaType === "movie" ? (
            <>
              <p>
                Duration: <b>{details.runtime} min.</b>
              </p>
              <p>
                Budget: <b>{formatCurrency(details.budget)}</b>
              </p>
              <p>
                Revenue: <b>{formatCurrency(details.revenue)}</b>
              </p>
            </>
          ) : (
            <>
              <p>
                Seasons: <b>{details.numberOfSeasons}</b>
              </p>
              <p>
                First air date: <b>{releaseDate}</b>
              </p>
              <p>
                Show type: <b>{details.showType}</b>
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Clapperboard size={16} />
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={tmdbWatchUrl(mediaType, id)}
            className="underline underline-offset-4"
          >
            Where to watch?
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-5 pt-8">
          <div className="flex items-center gap-1 hover:underline">
            <Film size={20} />
            <a href="#trailer">Trailer</a>
          </div>
          <div className="flex items-center gap-1 hover:underline">
            <Images size={20} />
            <a href="#gallery">Gallery</a>
          </div>
          <div className="flex items-center gap-1 hover:underline">
            <MessageCircleMore size={20} />
            <a href="#reviews">Reviews</a>
          </div>
        </div>
        <ListEntryDialog
          mode="add"
          movieId={id}
          fullSize={true}
          signedIn={session?.user !== undefined}
          title={title}
          image={backdropPath || posterPath || ""}
          type={mediaType}
        />
      </div>
    </section>
  );
}
