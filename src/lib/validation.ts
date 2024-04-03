import { z } from "zod";

export const movieFilterSchema = z.object({
  query: z.string(),
  language: z.string().optional(),
  year: z.string().optional(),
  adult: z.coerce.boolean().optional(),
  btn: z.string().optional(),
  page: z.string().optional(),
});

export type movieFilterValues = z.infer<typeof movieFilterSchema>;
