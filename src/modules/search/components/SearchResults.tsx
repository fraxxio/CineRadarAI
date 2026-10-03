import { movieFilterValues } from "../validation";
import { findTitles } from "@/infra/tmdb/server";
import { getSession } from "@/infra/auth/session";
import MovieCard from "./MovieCard";
import { Pages } from "./Pages";

type SearchResultsProps = {
  filterValues: movieFilterValues;
  getTitle: (values: movieFilterValues) => string;
};

export default async function SearchResults({
  filterValues: { query, language, year, adult, btn, page },
  getTitle,
}: SearchResultsProps) {
  const mediaType = btn ?? "movie";
  // TMDB matches any of the "|"-separated words
  const searchString = query
    ?.split(" ")
    .filter((word) => word.length > 0)
    .join("|");

  const [titles, session] = await Promise.all([
    findTitles({
      mediaType,
      query: searchString,
      language,
      year,
      includeAdult: adult,
      page,
    }),
    // read once here, not per card
    getSession(),
  ]);
  const signedIn = session?.user !== undefined;

  return (
    <section className="w-full max-w-[70%] max-lg:max-w-full">
      <h1 className="pb-8 text-center text-2xl font-medium">
        {getTitle({ query, language, year, adult, btn })}
      </h1>
      {titles.results.length === 0 ? (
        <h1 className="w-full text-center text-2xl font-medium">
          No results with these filters were found. Try something else.
        </h1>
      ) : (
        <div className="grid grid-cols-3 gap-4 max-[700px]:grid-cols-2 max-[450px]:grid-cols-1">
          {titles.results.map((title) => {
            return (
              <MovieCard
                type={mediaType}
                key={title.id}
                movie={title}
                signedIn={signedIn}
              />
            );
          })}
          <Pages
            filterValues={{ query, language, year, adult, btn, page }}
            page={page}
            totalResults={titles.totalResults}
            totalPages={titles.totalPages}
          />
        </div>
      )}
    </section>
  );
}
