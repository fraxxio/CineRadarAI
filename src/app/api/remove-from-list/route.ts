import { db } from "@/db";
import { lists } from "@/db/schema/lists";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function DELETE(request: Request) {
  const userId = request.headers.get("userId") as string;
  const movieId = Number(request.headers.get("movieId") as string);

  // Find the existing row
  const existingRows = await db
    .select({ movies: lists.movies })
    .from(lists)
    .where(eq(lists.userId, userId))
    .limit(1)
    .all();

  if (existingRows.length === 0) {
    return Response.json({ addToListResult: "fail" });
  }

  try {
    // Remove the movie with movieId from the movies array
    const updatedMovies = existingRows[0].movies!.filter(
      (movie) => movie.movieId !== movieId,
    );

    // Update the list with the new movies array
    await db
      .update(lists)
      .set({ movies: updatedMovies })
      .where(eq(lists.userId, userId))
      .execute();

    revalidatePath("/my-list", "page");
    return Response.json({ addToListResult: "success" });
  } catch (error) {
    console.error(error);
    return Response.json({ addToListResult: "fail" });
  }
}
