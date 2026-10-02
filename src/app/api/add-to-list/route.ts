import { auth } from "@/infra/auth/auth";
import { db } from "@/infra/db";
import { lists } from "@/infra/db/schema/lists";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const addToListSchema = z.object({
  movieId: z.coerce.number().int().positive(),
  title: z.string().min(1),
  // MovieCard/Details send null when TMDB has no poster or backdrop
  image: z
    .string()
    .nullable()
    .transform((image) => image ?? ""),
  status: z.enum(["Planning to watch", "Completed", "Watching"]),
  rating: z.union([z.literal(""), z.coerce.number().int().min(1).max(10)]),
  type: z.enum(["movie", "tv"]),
});

export async function PUT(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ addToListResult: "fail" }, { status: 401 });
  }

  const parsed = addToListSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ addToListResult: "fail" }, { status: 400 });
  }
  const requestData = parsed.data;

  const newMovie = {
    name: requestData.title,
    image: requestData.image,
    status: requestData.status,
    rating: requestData.rating === "" ? 0 : requestData.rating,
    movieId: requestData.movieId,
    type: requestData.type,
  };

  try {
    //Find the existing row
    const existingRows = await db
      .select({ movies: lists.movies })
      .from(lists)
      .where(eq(lists.userId, userId))
      .limit(1)
      .all();

    if (existingRows.length > 0) {
      // If row exists, retrieve and update the movies array
      let existingMovies = existingRows[0].movies || [];
      // movie and TV ids can collide, so match on both
      const movieIndex = existingMovies.findIndex(
        (movie) =>
          movie.movieId === newMovie.movieId && movie.type === newMovie.type,
      );

      if (movieIndex !== -1) {
        // Replace existing movie with newMovie
        existingMovies[movieIndex] = newMovie;
      } else {
        // Add newMovie to the array
        existingMovies.push(newMovie);
      }

      // Update the row with the updated movies array
      await db
        .update(lists)
        .set({ movies: existingMovies })
        .where(eq(lists.userId, userId));
    } else {
      // If row does not exist, insert it with the new movie in an array
      await db.insert(lists).values({
        userId: userId,
        movies: [newMovie],
      });
    }

    revalidatePath("/my-list", "page");
    return Response.json({ addToListResult: "success" });
  } catch (error) {
    console.error(error);
    return Response.json({ addToListResult: "fail" });
  }
}
