import Filters from "@/Components/Filters";
import SearchResults from "@/Components/SearchResults";
import { movieFilterValues } from "@/lib/validation";
import { Metadata } from "next";

type PageProps = {
  searchParams: {
    query: string | "";
    language?: string;
    year?: string;
    adult?: string;
    btn?: string;
    page?: string;
  };
};

function getTitle({ query, language, year, adult }: movieFilterValues) {
  const lang = language ? ` in ${language.toUpperCase()} language` : "";
  const Year = year ? `, ${year} year` : "";
  const including = adult ? `, including adult.` : "";
  const title = query
    ? `Results for: ${query}${lang}${Year}${including}`
    : "Trending movies";

  return title;
}

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
      <SearchResults filterValues={filterValues} getTitle={getTitle} />
    </main>
  );
}
