import Filters from "@/Components/Filters";
import SearchResults from "@/Components/SearchResults";
import { SearchResultsSkeleton } from "@/Components/skeletons/SearchResultsSkeleton";
import { getTitle } from "@/lib/searchTitle";
import { movieFilterValues } from "@/lib/validation";
import { Metadata } from "next";
import { Suspense } from "react";

type PageProps = {
  searchParams: {
    query: string | "";
    language?: string;
    year?: string;
    adult?: string;
    btn: "movie" | "tv";
    page?: string;
  };
};

export function generateMetadata({
  searchParams: { query, language = "en", year, adult, btn = "movie" },
}: PageProps): Metadata {
  const dynamicTitle = getTitle({
    query,
    language,
    year,
    btn,
    adult: adult === "true",
  });
  const title =
    dynamicTitle === "Trending movies" ? "Manual search" : dynamicTitle;
  return {
    title: `${title} | CineRadar`,
  };
}

export default function page({
  searchParams: {
    query,
    language = "en",
    year,
    adult,
    btn = "movie",
    page = "1",
  },
}: PageProps) {
  const filterValues: movieFilterValues = {
    query,
    language,
    year,
    btn,
    adult: adult === "true",
    page,
  };

  return (
    <main className="container flex gap-12 py-20 max-lg:flex-col">
      <Filters filterValues={filterValues} />
      <Suspense
        key={JSON.stringify(filterValues)}
        fallback={<SearchResultsSkeleton />}
      >
        <SearchResults filterValues={filterValues} getTitle={getTitle} />
      </Suspense>
    </main>
  );
}
