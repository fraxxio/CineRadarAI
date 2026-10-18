import { getListCounts, getListPage } from "@/modules/my-list/server";
import {
  ListLength,
  ListPager,
  MyListItems,
  ListRowsSkeleton,
  ListSortBtn,
  ListSortLink,
  countsFor,
  listHref,
  pageCount,
  parseListView,
  type ListView,
} from "@/modules/my-list";
import { getSession } from "@/infra/auth/session";
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
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function page({ searchParams }: UrlParams) {
  const session = await getSession();
  if (session?.user === undefined) {
    redirect("/signin");
  }
  const safeSession = session!;
  const userId = safeSession.user.id;

  const view = parseListView(searchParams);
  // awaited so a page past the end can redirect before streaming starts
  const counts = countsFor(await getListCounts(userId), view.type);
  const total = counts[view.status];
  const lastPage = pageCount(total);
  if (view.page > lastPage) {
    redirect(listHref(view, { page: lastPage }));
  }

  // not awaited: the rows stream in their own Suspense boundary
  const entries = getListPage(userId, view);
  const { status, type, sort } = view;
  const sortHref = (changes: Partial<ListView>) => listHref(view, changes);

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
          <ListLength length={total} />
        </div>
        <div className="flex items-center justify-center gap-8 pb-8 max-[1070px]:flex-col">
          <div>
            <p className="pb-2 text-center text-lg font-medium">Sort by:</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <ListSortLink
                href={sortHref({ sort: "rating-desc" })}
                isActive={sort === "rating-desc"}
              >
                Highest rated
              </ListSortLink>
              <ListSortLink
                href={sortHref({ sort: "rating-asc" })}
                isActive={sort === "rating-asc"}
              >
                Lowest rated
              </ListSortLink>
              <ListSortLink
                href={sortHref({ sort: "recent" })}
                isActive={sort === "recent"}
              >
                Recently added
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
        <Suspense key={listHref(view, {})} fallback={<ListRowsSkeleton />}>
          <MyListItems entries={entries} page={view.page} />
        </Suspense>
        <ListPager view={view} total={total} />
      </section>
    </main>
  );
}
