import { db } from "@/db";
import { lists } from "@/db/schema/lists";
import { eq } from "drizzle-orm";

export async function PUT(request: Request) {
  const userId = request.headers.get("userId") as string;
  const newMovie = {
    name: request.headers.get("title") as string,
    image: request.headers.get("image") as string,
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
      const existingMovies = existingRows[0].movies;
      const updatedMovies = [...(existingMovies || []), newMovie];

      // Update the row with the updated movies array
      await db
        .update(lists)
        .set({ movies: updatedMovies })
        .where(eq(lists.userId, userId));
    } else {
      // If row does not exist, insert it with the new movie in an array
      await db.insert(lists).values({
        userId: userId,
        movies: [newMovie],
      });
    }

    return Response.json({ addToListResult: "success" });
  } catch (error) {
    console.error(error);
    return Response.json({ addToListResult: "fail" });
  }
}
