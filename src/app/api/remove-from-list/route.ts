import { auth } from "@/auth";
import { db } from "@/db";
import { lists } from "@/db/schema/lists";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function DELETE(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ addToListResult: "fail" }, { status: 401 });
  }

  const movieId = Number(request.headers.get("movieId"));
  const type = request.headers.get("type");
  if (
    !Number.isInteger(movieId) ||
    movieId <= 0 ||
    (type !== "movie" && type !== "tv")
  ) {
    return Response.json({ addToListResult: "fail" }, { status: 400 });
  }

  try {
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

    // Remove the entry; movie and TV ids can collide, so match on both
    const updatedMovies = (existingRows[0].movies || []).filter(
      (movie) => movie.movieId !== movieId || movie.type !== type,
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
