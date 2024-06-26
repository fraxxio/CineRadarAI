import { movieFilterValues } from "@/lib/validation";
import MovieCard from "./ui/MovieCard";
import { Pages } from "./ui/Pages";

type SearchResultsProps = {
  filterValues: movieFilterValues;
  getTitle: ({
    query,
    language,
    year,
    adult,
  }: {
    query: string | undefined;
    language?: string | undefined;
    year?: string | undefined;
    adult?: boolean | undefined;
  }) => string;
};

async function fetchMovies({
  searchString,
  language,
  year,
  adult,
  btn,
  page,
}: fetchMoviesProps) {
  "use server";

  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
    },
  };

  const query = searchString === undefined ? "" : `query=${searchString}`;
  const Year = year === undefined ? "" : `&year=${year}`;
  const FetchType = query === "" ? "discover" : "search";

  const fetchURL = `${process.env.TMDB_BASE_URL}/${FetchType}/${btn}?${query}&include_adult=${adult}&language=${language}&page=${page}${Year}`;

  try {
    const response = await fetch(fetchURL, options);
    if (!response.ok) {
      const error = new Error(
        `Failed to fetch search results (Status: ${response.status})`,
      );
      throw error;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching search results:", error);
    throw error;
  }
}

export default async function SearchResults({
  filterValues: { query, language, year, adult, btn, page },
  getTitle,
}: SearchResultsProps) {
  const searchString = query
    ?.split(" ")
    .filter((word) => word.length > 0)
    .join("|");

  const fetchedData: FetchedData = await fetchMovies({
    searchString,
    language,
    year,
    adult,
    btn,
    page,
  });

  return (
    <section className="w-full max-w-[70%] max-lg:max-w-full">
      <h1 className="pb-8 text-center text-2xl font-medium">
        {getTitle({ query, language, year, adult })}
      </h1>
      {fetchedData.results.length === 0 ? (
        <h1 className="w-full text-center text-2xl font-medium">
          No results with these filters were found. Try something else.
        </h1>
      ) : (
        <div className="grid grid-cols-3 gap-4 max-[700px]:grid-cols-2 max-[450px]:grid-cols-1">
          {fetchedData.results.map((movie: Results) => {
            return <MovieCard type={btn} key={movie.id} movie={movie} />;
          })}
          <Pages
            filterValues={{ query, language, year, adult, btn, page }}
            page={page}
            totalResults={fetchedData.total_results}
            totalPages={fetchedData.total_pages}
          />
        </div>
      )}
    </section>
  );
}
