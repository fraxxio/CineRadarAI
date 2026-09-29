import MyListItems, {
  ListLength,
  ListSortValues,
} from "@/Components/MyListItems";
import { ListLengthSkeleton } from "@/Components/skeletons/ListLengthSkeleton";
import { ListRowsSkeleton } from "@/Components/skeletons/ListRowsSkeleton";
import ListSortBtn from "@/Components/ui/ListSortBtn";
import ListSortLink from "@/Components/ui/ListSortLink";
import { getSession } from "@/lib/session";
import { RotateCcw } from "lucide-react";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "My list | CineRadar",
  description: "Movie and TV show list",
  icons: "/CineRadarLogo.png",
};

type UrlParams = {
  searchParams: Partial<ListSortValues>;
};

export default async function page({
  searchParams: { type = "both", status = "all", rating = "desc" },
}: UrlParams) {
  const session = await getSession();
  if (session?.user === undefined) {
    redirect("/signin");
  }
  const safeSession = session!;

  const sortValues = { rating, status, type };
  const sortKey = `${type}-${status}-${rating}`;
  const sortHref = (value: Partial<ListSortValues>) =>
    `/my-list?${new URLSearchParams({ ...sortValues, ...value })}`;

  return (
    <main className="container">
      <section className="my-20 border border-border-clr bg-primary-bg">
        <div className="relative flex items-center justify-between p-8 pb-12 max-[1070px]:flex-col max-[1070px]:gap-4">
          <form
            action={async () => {
              "use server";
              redirect("/my-list");
            }}
          >
            <ListSortBtn type="submit" withIcon>
              <RotateCcw size={18} />
              Refresh list
            </ListSortBtn>
          </form>
          <h1 className="text-center text-3xl">
            <b>{safeSession.user.name}</b> movie and TV show list.
          </h1>
          <Suspense key={sortKey} fallback={<ListLengthSkeleton />}>
            <ListLength {...sortValues} />
          </Suspense>
        </div>
        <div className="flex items-center justify-center gap-8 pb-8 max-[1070px]:flex-col">
          <div>
            <p className="pb-2 text-center text-lg font-medium">
              Sort by rating:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <ListSortLink
                href={sortHref({ rating: "asc" })}
                isActive={rating === "asc"}
              >
                Ascending
              </ListSortLink>
              <ListSortLink
                href={sortHref({ rating: "desc" })}
                isActive={rating === "desc"}
              >
                Descending
              </ListSortLink>
            </div>
          </div>
          <div>
            <p className="pb-2 text-center text-lg font-medium">Type:</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <ListSortLink
                href={sortHref({ type: "tv" })}
                isActive={type === "tv"}
              >
                TV shows
              </ListSortLink>
              <ListSortLink
                href={sortHref({ type: "movie" })}
                isActive={type === "movie"}
              >
                Movies
              </ListSortLink>
              <ListSortLink
                href={sortHref({ type: "both" })}
                isActive={type === "both"}
              >
                Both
              </ListSortLink>
            </div>
          </div>
          <div>
            <p className="pb-2 text-center text-lg font-medium">Show only:</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <ListSortLink
                href={sortHref({ status: "completed" })}
                isActive={status === "completed"}
              >
                Completed
              </ListSortLink>
              <ListSortLink
                href={sortHref({ status: "planning" })}
                isActive={status === "planning"}
              >
                Planning to watch
              </ListSortLink>
              <ListSortLink
                href={sortHref({ status: "watching" })}
                isActive={status === "watching"}
              >
                Watching
              </ListSortLink>
              <ListSortLink
                href={sortHref({ status: "all" })}
                isActive={status === "all"}
              >
                All
              </ListSortLink>
            </div>
          </div>
        </div>
        <Suspense key={sortKey} fallback={<ListRowsSkeleton />}>
          <MyListItems {...sortValues} />
        </Suspense>
      </section>
    </main>
  );
}
