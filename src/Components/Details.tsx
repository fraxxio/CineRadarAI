import Image from "next/image";
import { formatCurrency } from "@/lib/utils";
import {
  Clapperboard,
  Film,
  ImageOff,
  Images,
  MessageCircleMore,
  Star,
} from "lucide-react";

type DetailsProps = {
  title: string;
  name: string;
  status: string;
  release_date: string;
  genres: [{ name: string; id: number }];
  overview: string;
  vote_average: number;
  vote_count: number;
  poster_path: string;
  backdrop_path: string;
  runtime: number;
  budget: number;
  revenue: number;
  last_air_date: string;
  first_air_date: number;
  number_of_seasons: number;
  type: string;
};

async function fetchDetails(id: number, mediaType: "movie" | "tv") {
  "use server";

  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
    },
  };

  const fetchURL = `${process.env.TMDB_BASE_URL}/${mediaType}/${id}?language=en-US`;

  try {
    const response = await fetch(fetchURL, options);
    if (!response.ok) {
      const error = new Error(
        `Failed to fetch ${mediaType} details (Status: ${response.status})`,
      );
      throw error;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching ${mediaType} details:`, error);
    throw error;
  }
}

export default async function Details({
  id,
  mediaType,
}: {
  id: number;
  mediaType: "movie" | "tv";
}) {
  const {
    title,
    name,
    poster_path,
    backdrop_path,
    overview,
    release_date,
    genres,
    runtime,
    revenue,
    budget,
    vote_average,
    vote_count,
    status,
    last_air_date,
    number_of_seasons,
    first_air_date,
    type,
  }: DetailsProps = await fetchDetails(id, mediaType);
  return (
    <section className="mt-20 flex gap-32 rounded-sm border border-border-clr bg-primary-bg max-[950px]:flex-col max-[950px]:gap-4">
      {poster_path || backdrop_path ? (
        <Image
          src={`https://image.tmdb.org/t/p/w500${poster_path || backdrop_path}`}
          alt={title || name}
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
            {title || name}
          </h1>
          <p className="pb-1 max-[930px]:text-sm">
            {status}: {release_date || last_air_date}
          </p>
        </div>
        <p className=" pt-4 text-lg text-secondary-text max-[930px]:text-[1rem]">
          {overview}
        </p>
        <div className="flex flex-wrap gap-2 pt-4">
          {genres.map((genre: { name: string; id: number }) => {
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
              {vote_average.toFixed(1)} / {vote_count}
            </p>
          </div>
          {type === "movie" ? (
            <p>
              Duration: <b>{runtime} min.</b>
            </p>
          ) : (
            <p>
              Seasons: <b>{number_of_seasons}</b>
            </p>
          )}
          {type === "movie" ? (
            <p>
              Budget: <b>{formatCurrency(budget)}</b>
            </p>
          ) : (
            <p>
              First air date: <b>{first_air_date}</b>
            </p>
          )}
          {type === "movie" ? (
            <p>
              Revenue: <b>{formatCurrency(revenue)}</b>
            </p>
          ) : (
            <p>
              Show type: <b>{type}</b>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Clapperboard size={16} />
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={`https://www.themoviedb.org/${mediaType}/${id}/watch`}
            className="underline underline-offset-4"
          >
            Where to watch?
          </a>
        </div>
        <div className="flex items-center gap-5 pt-8">
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
      </div>
    </section>
  );
}
