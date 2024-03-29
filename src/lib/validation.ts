import { z } from "zod";

export const movieFilterSchema = z.object({
  query: z.string().optional(),
  language: z.string().optional(),
  year: z.string().optional(),
  adult: z.coerce.boolean().optional(),
  btn: z.string().optional(),
});

export type movieFilterValues = z.infer<typeof movieFilterSchema>;
