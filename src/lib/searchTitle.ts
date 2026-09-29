import { movieFilterValues } from "./validation";

export function getTitle({ query, language, year, adult }: movieFilterValues) {
  const lang = language ? ` in ${language.toUpperCase()} language` : "";
  const Year = year ? `, ${year} year` : "";
  const including = adult ? `, including adult.` : "";
  const title = query
    ? `Results for: ${query}${lang}${Year}${including}`
    : "Trending movies";

  return title;
}
