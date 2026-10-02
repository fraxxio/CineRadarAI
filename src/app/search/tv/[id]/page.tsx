import { Details, Gallery, Reviews, Trailer } from "@/modules/title/server";
import {
  DetailsSkeleton,
  GallerySkeleton,
  ReviewsSkeleton,
  TrailerSkeleton,
} from "@/modules/title";
import { getTitle } from "@/infra/tmdb/server";
import { Metadata } from "next";
import { Suspense } from "react";

export async function generateMetadata({
  params,
}: {
  params: { id: number };
}): Promise<Metadata> {
  const details = await getTitle("tv", params.id);
  return {
    title: `${details.title} | CineRadar`,
  };
}

export default function page({ params }: { params: { id: number } }) {
  return (
    <main className="container">
      <Suspense fallback={<DetailsSkeleton />}>
        <Details id={params.id} mediaType="tv" />
      </Suspense>
      <Suspense fallback={<TrailerSkeleton />}>
        <Trailer id={params.id} mediaType="tv" />
      </Suspense>
      <Suspense fallback={<GallerySkeleton />}>
        <Gallery id={params.id} mediaType="tv" />
      </Suspense>
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews id={params.id} mediaType="tv" />
      </Suspense>
    </main>
  );
}
