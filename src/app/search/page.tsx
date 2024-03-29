import Filters from "@/Components/Filters";
import SearchResults from "@/Components/SearchResults";
import { movieFilterValues } from "@/lib/validation";

type PageProps = {
  searchParams: {
    query?: string;
    language?: string;
    year?: string;
    adult?: string;
    btn?: string;
  };
};

export default function page({
  searchParams: { query, language = "en", year, adult, btn = "movie" },
}: PageProps) {
  const filterValues: movieFilterValues = {
    query,
    language,
    year,
    btn,
    adult: adult === "true",
  };

  return (
    <main className="container flex gap-12 py-20 max-lg:flex-col">
      <Filters />
      <SearchResults filterValues={filterValues} />
    </main>
  );
}
