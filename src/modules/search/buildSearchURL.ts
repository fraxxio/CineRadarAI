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
