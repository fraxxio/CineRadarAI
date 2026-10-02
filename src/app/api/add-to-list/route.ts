import { auth } from "@/infra/auth/auth";
import { db } from "@/infra/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { entryInput, lists } from "@/modules/my-list/server";

export async function PUT(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ addToListResult: "fail" }, { status: 401 });
  }

  const parsed = entryInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ addToListResult: "fail" }, { status: 400 });
  }
  const newMovie = parsed.data;

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
