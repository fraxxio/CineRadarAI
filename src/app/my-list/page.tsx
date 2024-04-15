import ListCard from "@/Components/ui/ListCard";
import { auth } from "@/auth";
import { db } from "@/db";
import { lists } from "@/db/schema/lists";
import { eq } from "drizzle-orm";
import { RotateCcw } from "lucide-react";
import { redirect } from "next/navigation";

export default async function page() {
  const session = await auth();
  if (session?.user === undefined) {
    redirect("/signin");
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
        <div className="relative flex items-center justify-between p-8 pb-12 ">
          <form
            action={async () => {
              "use server";
              redirect("/my-list");
            }}
          >
            <button
              type="submit"
              className="flex items-center gap-1 rounded-md border border-border-clr bg-dark-bg px-2 py-1 duration-200 hover:bg-primary-text hover:text-dark-bg"
            >
              <RotateCcw size={18} />
              Refresh list
            </button>
          </form>
          <h1 className="text-center text-3xl">
            <b>{safeSession.user.name}</b> movie and TV show list.
          </h1>
          <p className="text-lg">Length: {moviesArray.length}</p>
        </div>
        <div className="border-t border-border-clr">
          {moviesArray.length === 0 ? (
            <div className="border-b border-border-clr py-4 text-center font-medium last:border-none">
              Your list is empty.
            </div>
          ) : (
            moviesArray.map((movie, index) => {
              return (
                <ListCard
                  key={movie.movieId}
                  movie={movie}
                  index={index}
                  user={safeSession.user}
                />
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
