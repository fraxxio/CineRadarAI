import { getListCounts, getListPage, getShelf } from "@/modules/my-list/server";
import {
  FilterGroup,
  FilterLink,
  ListEmpty,
  ListPager,
  ListShelves,
  ListShelvesSkeleton,
  MyListItems,
  ListRowsSkeleton,
  StatusTabs,
  countsFor,
  isFiltered,
  listHref,
  pageCount,
  parseListView,
  shelfStatuses,
  type ListCounts,
  type ListView,
  type ShelfEntries,
} from "@/modules/my-list";
import { getSession } from "@/infra/auth/session";
import { RotateCcw } from "lucide-react";
import Link from "next/link";
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

// one small query per non-empty status, in parallel
const readShelves = async (
  userId: string,
  { type, sort }: ListView,
  counts: ListCounts,
): Promise<ShelfEntries> =>
  Object.fromEntries(
    await Promise.all(
      shelfStatuses(counts).map(
        async (status) =>
          [status, await getShelf(userId, { status, type, sort })] as const,
      ),
    ),
  );

export default async function page({ searchParams }: UrlParams) {
  const session = await getSession();
  if (session?.user === undefined) {
    redirect("/signin");
  }
  const safeSession = session!;
  const userId = safeSession.user.id;

  const view = parseListView(searchParams);
  // awaited so a page past the end can redirect before streaming starts
  const countRows = await getListCounts(userId);
  const counts = countsFor(countRows, view.type);
  // the whole list, whatever the type
  const listTotal = countsFor(countRows, "both").all;
  const total = counts[view.status];
  // the "All" tab is always page 1, so it never redirects
  const lastPage = pageCount(total);
  if (view.page > lastPage) {
    redirect(listHref(view, { page: lastPage }));
  }

  const { type, sort } = view;
  const viewHref = (changes: Partial<ListView>) => listHref(view, changes);
  const name = safeSession.user.name;

  return (
    <main className="container">
      <section className="my-20 border border-border-clr bg-primary-bg">
        <div className="flex flex-wrap items-start justify-between gap-4 px-8 pb-4 pt-8 max-[480px]:px-4">
          <div>
            <h1 className="text-3xl font-medium">
              {name ? `${name}'s list` : "Your list"}
            </h1>
            <p className="pt-1 text-secondary-text">
              {listTotal} {listTotal === 1 ? "title" : "titles"}
            </p>
          </div>
          {isFiltered(view) && (
            <Link
              href="/my-list"
              className="flex items-center gap-2 rounded-md border border-border-clr bg-dark-bg px-3 py-1.5 text-sm duration-200 hover:bg-primary-text hover:text-dark-bg"
            >
              <RotateCcw size={16} aria-hidden />
              Reset filters
            </Link>
          )}
        </div>
        <StatusTabs view={view} counts={counts} />
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border-clr px-8 py-4 max-[480px]:px-4">
          <FilterGroup id="list-type-label" label="Type">
            <FilterLink
              href={viewHref({ type: "both" })}
              isActive={type === "both"}
            >
              All
            </FilterLink>
            <FilterLink
              href={viewHref({ type: "movie" })}
              isActive={type === "movie"}
            >
              Movies
            </FilterLink>
            <FilterLink
              href={viewHref({ type: "tv" })}
              isActive={type === "tv"}
            >
              TV
            </FilterLink>
          </FilterGroup>
          <FilterGroup id="list-sort-label" label="Sort by">
            <FilterLink
              href={viewHref({ sort: "rating-desc" })}
              isActive={sort === "rating-desc"}
            >
              Highest rated
            </FilterLink>
            <FilterLink
              href={viewHref({ sort: "rating-asc" })}
              isActive={sort === "rating-asc"}
            >
              Lowest rated
            </FilterLink>
            <FilterLink
              href={viewHref({ sort: "recent" })}
              isActive={sort === "recent"}
            >
              Recently added
            </FilterLink>
          </FilterGroup>
        </div>
        {total === 0 ? (
          <ListEmpty
            filtered={listTotal > 0}
            chatEnabled={process.env.AI_CHAT_ENABLED === "true"}
          />
        ) : view.status === "all" ? (
          <Suspense key={listHref(view, {})} fallback={<ListShelvesSkeleton />}>
            {/* not awaited: the shelves stream in their own boundary */}
            <ListShelves
              view={view}
              counts={counts}
              shelves={readShelves(userId, view, counts)}
            />
          </Suspense>
        ) : (
          <>
            <Suspense key={listHref(view, {})} fallback={<ListRowsSkeleton />}>
              {/* not awaited: the rows stream in their own boundary */}
              <MyListItems entries={getListPage(userId, view)} />
            </Suspense>
            <ListPager view={view} total={total} />
          </>
        )}
      </section>
    </main>
  );
}
