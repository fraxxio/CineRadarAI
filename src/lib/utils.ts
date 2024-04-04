import { movieFilterSchema } from "./validation";

type getNewURLProps = {
  newPage: number;
  filterValues: object;
};

export function getNewURL({ newPage, filterValues }: getNewURLProps) {
  const { query, language, year, adult, btn } =
    movieFilterSchema.parse(filterValues);
  const searchParams = new URLSearchParams({
    ...(query && { query: query.trim() }),
    ...(language && { language }),
    ...(year && { year }),
    ...(adult && { adult: "false" }),
    ...(btn && { btn }),
    ...(newPage !== undefined && { page: String(newPage) }),
  });
  return `/search?${searchParams.toString()}`;
}
