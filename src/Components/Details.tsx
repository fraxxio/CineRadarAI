import Image from "next/image";
import { formatCurrency } from "@/lib/utils";
import { Clapperboard, Star } from "lucide-react";

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
};

async function fetchDetails(id: string) {
  "use server";

  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
    },
  };

  const fetchURL = `${process.env.TMDB_BASE_URL}/movie/${id}?language=en-US`;

  try {
    const response = await fetch(fetchURL, options);
    if (!response.ok) {
      const error = new Error(
        `Failed to fetch movie details (Status: ${response.status})`,
      );
      throw error;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching movie details:", error);
    throw error;
  }
}

export default async function Details({ id }: { id: number }) {
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
  }: DetailsProps = await fetchDetails(id.toString());
  return (
    <section className="mt-20 flex gap-32 rounded-sm border border-border-clr bg-primary-bg">
      <Image
        src={`https://image.tmdb.org/t/p/w500${poster_path || backdrop_path}`}
        alt={title || name}
        width={150}
        height={150}
        className="w-[30%] border-b border-border-clr object-cover"
        sizes="(max-width: 768px) 100vw, 33vw"
      />
      <div className="items-startp-4 my-auto pr-12">
        <div className="flex items-end justify-between">
          <h1 className="max-w-[35rem] text-3xl font-medium">{title}</h1>
          <p className="pb-1">
            {status}: {release_date}
          </p>
        </div>
        <p className=" pt-4 text-lg text-secondary-text">{overview}</p>
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
        <div className="flex justify-between gap-4 py-8 text-lg">
          <div className="flex items-center gap-2 text-yellow-600">
            <Star size={18} />
            <p>
              {vote_average.toFixed(1)} / {vote_count}
            </p>
          </div>
          <p>
            Duration: <b>{runtime} min.</b>
          </p>
          <p>
            Budget: <b>{formatCurrency(budget)}</b>
          </p>
          <p>
            Revenue: <b>{formatCurrency(revenue)}</b>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Clapperboard size={16} />
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={`https://www.themoviedb.org/movie/${id}/watch`}
            className="underline underline-offset-4"
          >
            Where to watch?
          </a>
        </div>
      </div>
    </section>
  );
}
