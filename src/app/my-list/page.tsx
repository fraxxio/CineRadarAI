import ListCard from "@/Components/ui/ListCard";
import { auth } from "@/auth";
import { db } from "@/db";
import { lists } from "@/db/schema/lists";
import { eq } from "drizzle-orm";
import { AlertTriangleIcon } from "lucide-react";

export default async function page() {
  const session = await auth();
  if (session?.user === undefined) {
    return (
      <main className="container flex items-center justify-center gap-4 pt-40">
        <AlertTriangleIcon size={50} color="red" />
        <p className="text-3xl">You need to be logged in to acces this page.</p>
      </main>
    );
  }
  const safeSession = session!;

  const result = await db
    .select({
      movies: lists.movies,
    })
    .from(lists)
    .where(eq(lists.userId, safeSession.user.id))
    .execute();

  const moviesArray = result[0]?.movies || [];

  return (
    <main className="container">
      <section className="my-20 border border-border-clr bg-primary-bg">
        <div className="relative flex items-center justify-center pb-12 pt-4 ">
          <h1 className="text-center text-3xl">
            <b>{safeSession.user.name}</b> movie and TV show list.
          </h1>
          <p className="absolute right-8 top-7 text-lg">
            Length: {moviesArray.length}
          </p>
        </div>
        <div className="border-t border-border-clr">
          {moviesArray.map((movie, index) => {
            return <ListCard key={movie.movieId} movie={movie} index={index} />;
          })}
        </div>
      </section>
    </main>
  );
}
