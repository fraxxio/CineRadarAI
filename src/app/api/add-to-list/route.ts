import { db } from "@/db";
import { lists } from "@/db/schema/lists";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function PUT(request: Request) {
  const userId = request.headers.get("userId") as string;
  const rating =
    request.headers.get("rating") === ""
      ? 0
      : Number(request.headers.get("rating") as string);

  const newMovie = {
    name: request.headers.get("title") as string,
    image: request.headers.get("image") as string,
    status: request.headers.get("status") as string,
    rating: rating,
    movieId: Number(request.headers.get("movieId") as string),
  };

  //Find the existing row
  const existingRows = await db
    .select({ movies: lists.movies })
    .from(lists)
    .where(eq(lists.userId, userId))
    .limit(1)
    .all();

  try {
    if (existingRows.length > 0) {
      // If row exists, retrieve and update the movies array
      let existingMovies = existingRows[0].movies || [];
      const movieIndex = existingMovies.findIndex(
        (movie) => movie.movieId === newMovie.movieId,
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
