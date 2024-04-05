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

export function formatCurrency(amount: number) {
  if (amount >= 1e9) {
    return "$" + (amount / 1e9).toFixed(1) + "B";
  }
  if (amount >= 1e6) {
    return "$" + (amount / 1e6).toFixed(1) + "M";
  }
  if (amount >= 1e3) {
    return "$" + (amount / 1e3).toFixed(1) + "k";
  }
  return "$" + amount.toString();
}
