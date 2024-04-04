"use server";

import { movieFilterSchema } from "@/lib/validation";
import { redirect } from "next/navigation";

export async function fetchMovies(formData: FormData) {
  const values = Object.fromEntries(formData.entries());
  const { query, language, year, adult, btn } = movieFilterSchema.parse(values);

  const searchParams = new URLSearchParams({
    ...(query && { query: query?.trim() }),
    ...(language && { language }),
    ...(year && { year }),
    ...(adult && { adult: "true" }),
    ...(btn && { btn }),
  });

  redirect(`/search?${searchParams.toString()}`);
}
