import { db } from "@/db";
import { lists } from "@/db/schema/lists";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function PUT(request: Request) {
  const requestData = await request.json();

  const userId = requestData.userId;
  const rating = requestData.rating === "" ? 0 : Number(requestData.rating);

  const newMovie = {
    name: requestData.title,
    image: requestData.image,
    status: requestData.status,
    rating: rating,
    movieId: Number(requestData.movieId),
    type: requestData.type,
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
