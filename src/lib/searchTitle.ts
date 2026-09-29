import { movieFilterValues } from "./validation";

export function getTitle({
  query,
  language,
  year,
  adult,
  btn,
}: movieFilterValues) {
  const lang = language ? ` in ${language.toUpperCase()} language` : "";
  const Year = year ? `, ${year} year` : "";
  const including = adult ? `, including adult.` : "";
  const title = query
    ? `Results for: ${query}${lang}${Year}${including}`
    : btn === "tv"
      ? "Trending TV shows"
      : "Trending movies";

  return title;
}
