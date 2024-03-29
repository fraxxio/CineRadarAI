import { movieFilterValues } from "@/lib/validation";

type SearchResultsProps = {
  filterValues: movieFilterValues;
};

type fetchMoviesProps = {
  searchString?: string | undefined;
  language?: string | undefined;
  year?: string | undefined;
  adult?: boolean | undefined;
  btn?: string | undefined;
};

async function fetchMovies({
  searchString,
  language,
  year,
  adult,
  btn,
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
  const fetchURL = `${process.env.TMDB_BASE_URL}/discover/${btn}?${query}&include_adult=${adult}&language=${language}&page=1${Year}&sort_by=popularity.desc`;

  try {
    const response = await fetch(fetchURL, options);
    if (!response.ok) {
      throw new Error("Failed to fetch languages");
    }
    return response.json();
  } catch (error) {
    console.error("Error fetching languages:", error);
    throw error;
  }
}

export default async function SearchResults({
  filterValues: { query, language, year, adult, btn },
}: SearchResultsProps) {
  const searchString = query
    ?.split(" ")
    .filter((word) => word.length > 0)
    .join("|");

  const fetchedData = await fetchMovies({
    searchString,
    language,
    year,
    adult,
    btn,
  });

  return (
    <section className="max-w-[70%]">{JSON.stringify(fetchedData)}</section>
  );
}
