import { movieFilterSchema } from "./validation";

export function buildSearchURL(values: object, page?: number) {
  const { query, language, year, adult, btn } = movieFilterSchema.parse(values);
  const searchParams = new URLSearchParams({
    ...(query && { query: query.trim() }),
    ...(language && { language }),
    ...(year && { year }),
    ...(adult && { adult: "true" }),
    ...(btn && { btn }),
    ...(page !== undefined && { page: String(page) }),
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
