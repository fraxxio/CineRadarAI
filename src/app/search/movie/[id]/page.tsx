import Details from "@/Components/Details";
import Gallery from "@/Components/Gallery";
import Reviews from "@/Components/Reviews";
import Trailer from "@/Components/Trailer";
import { Metadata } from "next";

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

export async function generateMetadata({
  params,
}: {
  params: { id: number };
}): Promise<Metadata> {
  const details = await fetchDetails(params.id.toString());
  return {
    title: `${details.title} | CineRadar`,
  };
}

export default async function page({ params }: { params: { id: number } }) {
  return (
    <main className="container">
      <Details id={params.id} mediaType="movie" />
      <Trailer id={params.id} mediaType="movie" />
      <Gallery id={params.id} mediaType="movie" />
      <Reviews id={params.id} mediaType="movie" />
    </main>
  );
}
