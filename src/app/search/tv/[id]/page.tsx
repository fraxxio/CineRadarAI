import Details from "@/Components/Details";
import Gallery from "@/Components/Gallery";
import Reviews from "@/Components/Reviews";
import Trailer from "@/Components/Trailer";
import { Metadata } from "next";
import React from "react";

async function fetchDetails(id: string) {
  "use server";

  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
    },
  };

  const fetchURL = `${process.env.TMDB_BASE_URL}/tv/${id}?language=en-US`;

  try {
    const response = await fetch(fetchURL, options);
    if (!response.ok) {
      const error = new Error(
        `Failed to fetch TV details (Status: ${response.status})`,
      );
      throw error;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching TV details:", error);
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
    title: `${details.name} | CineRadar`,
  };
}

export default function page({ params }: { params: { id: number } }) {
  return (
    <main className="container">
      <Details id={params.id} mediaType="tv" />
      <Trailer id={params.id} mediaType="tv" />
      <Gallery id={params.id} mediaType="tv" />
      <Reviews id={params.id} mediaType="tv" />
    </main>
  );
}
