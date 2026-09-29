# Plan: instant page navigation with skeleton loaders

Goal: when a user clicks any internal link, button or filter, the URL and the UI should change immediately. If data isn't ready, show a skeleton shaped like the target page, then stream the real content in. Today the app freezes on the old page until the server has finished rendering the new one.

Stack: Next.js **14.1.3** App Router, React 18, Tailwind 3, NextAuth v5 beta with the Drizzle adapter (**database sessions**), and Turso/libsql. There are no tests in the repo.

---

## 1. Root cause

- The repo has **no `loading.tsx` and no `<Suspense>` boundary**.
- Every route is dynamic, because `auth()` in the root [layout.tsx](src/app/layout.tsx) reads cookies, and the pages read `searchParams` or `params`.
- For a dynamic route with no loading boundary, the App Router keeps the old page on screen during a soft navigation until the whole RSC payload for the new page has been rendered on the server. That wait is the "freeze".
- A `loading.tsx` fixes this. `<Link>` prefetches each dynamic route **down to its nearest `loading.tsx`** while the link is in the viewport. On click, the router shows that prefetched loading UI immediately and streams the rest.

Other things that add to the delay or bypass the fix:

| Issue | Where | Effect |
|---|---|---|
| Links in AI chat replies are plain `<a>` tags, because `react-markdown` renders them by default | [AssistantMessage.tsx](src/Components/ui/AssistantMessage.tsx) | Full page reload: blank screen and a full server render |
| The search filters submit a server action that calls `redirect()` | [Filters.tsx](src/Components/Filters.tsx) → `fetchMovies` in [actions.ts](src/app/actions.ts) | The action's response carries the new page, so it waits for the full render and loading boundaries never show |
| My-list sort buttons submit a server action that calls `redirect()` | [my-list/page.tsx](src/app/my-list/page.tsx) → `SortList` in [actions.ts](src/app/actions.ts) | Same as above, and there's no pending indicator at all |
| `auth()` is called once per `MovieCard`, and with database sessions every call is a database round-trip | [MovieCard.tsx:51](src/Components/ui/MovieCard.tsx#L51), plus the layout, [Details.tsx:89](src/Components/Details.tsx#L89) and the my-list page | About 20 or more session lookups for each search page render |
| The middleware runs `auth` on every request, including prefetches and assets, because there's no `matcher` | [middleware.ts](src/middleware.ts) | An extra database lookup on every request. It only needs to protect `/my-list`. |
| The mobile nav links to `/mylist` | [Navbar.tsx:94](src/Components/Navbar.tsx#L94) | 404. It should be `/my-list`. |

---

## 2. Implementation steps

Do the steps in order. Each step can be verified on its own.

### Step 1: skeleton primitive

Create `src/Components/ui/Skeleton.tsx`, a server component:

```tsx
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-sm bg-border-clr", className)} />;
}
```

`bg-border-clr` might not exist as a background utility, because `border-clr` is only defined under `borderColor` in [tailwind.config.ts](tailwind.config.ts). If it doesn't, add `"border-clr": "rgba(39, 195, 233, 0.15)"` under `colors`, or use `bg-primary-text/10`. Pick whichever reads well on `bg-primary-bg` and `bg-dark-bg`.

Put the page and section skeletons in `src/Components/skeletons/`. **Size every skeleton to match the real markup**: the same container, section classes, borders, margins and heights. That way nothing jumps when the content arrives. Copy the outer `section`/`main` class names from the real components.

### Step 2: route-level `loading.tsx` (this is what makes the click instant)

| File | Content |
|---|---|
| `src/app/search/loading.tsx` | `<main className="container flex gap-12 py-20 max-lg:flex-col">` containing a filters-sidebar skeleton (same classes as the `aside` in [Filters.tsx](src/Components/Filters.tsx)) and `<SearchResultsSkeleton />` |
| `src/app/search/movie/[id]/loading.tsx` | `<DetailsPageSkeleton />` |
| `src/app/search/tv/[id]/loading.tsx` | `<DetailsPageSkeleton />` |
| `src/app/my-list/loading.tsx` | Header, three rows of sort buttons, and about 5 list rows, sized like [ListCard.tsx](src/Components/ui/ListCard.tsx) |
| `src/app/loading.tsx` | A generic fallback for `/`, `/about`, `/signin` and anything else: a `container` with one bordered `bg-primary-bg` block of skeleton lines |

Skeleton components to create in `src/Components/skeletons/`:

- `SearchResultsSkeleton`: a title line, then the same grid as [SearchResults.tsx](src/Components/SearchResults.tsx) (`grid grid-cols-3 gap-4 max-[700px]:grid-cols-2 max-[450px]:grid-cols-1`) containing 9 or more `MovieCardSkeleton`s. Each card has a `h-[30rem]` poster block and a `h-[6.5rem]` footer with two lines, matching [MovieCard.tsx](src/Components/ui/MovieCard.tsx).
- `DetailsSkeleton`, `TrailerSkeleton`, `GallerySkeleton` and `ReviewsSkeleton`, each matching the outer `section` of [Details.tsx](src/Components/Details.tsx), [Trailer.tsx](src/Components/Trailer.tsx), [Gallery.tsx](src/Components/Gallery.tsx) and [Reviews.tsx](src/Components/Reviews.tsx).
- `DetailsPageSkeleton`: `<main className="container">` with the four section skeletons above.

### Step 3: re-trigger the search skeleton when only the search params change

Pagination ([PageBtn.tsx](src/Components/ui/PageBtn.tsx)) and filter changes only change the search params of `/search`. Don't rely on `loading.tsx` re-appearing for those. In [search/page.tsx](src/app/search/page.tsx), wrap the results in a keyed boundary so the filters stay visible and only the grid shows a skeleton:

```tsx
<Suspense key={JSON.stringify(filterValues)} fallback={<SearchResultsSkeleton />}>
  <SearchResults filterValues={filterValues} getTitle={getTitle} />
</Suspense>
```

A new `key` mounts a new boundary, so the fallback shows even though the navigation runs in a transition.

Apply the same pattern to [my-list/page.tsx](src/app/my-list/page.tsx):

- Move the database query and the list rendering into an async `MyListItems` server component.
- Keep the header and the sort controls outside the boundary, so they render immediately.
- Wrap `MyListItems` in `<Suspense key={`${type}-${status}-${rating}`} fallback={<ListRowsSkeleton />}>`.

### Step 4: stream the detail pages section by section

In [movie/[id]/page.tsx](src/app/search/movie/[id]/page.tsx) and [tv/[id]/page.tsx](src/app/search/tv/[id]/page.tsx), wrap each of `Details`, `Trailer`, `Gallery` and `Reviews` in its own `<Suspense fallback={<XSkeleton />}>`. Each section then appears when its own TMDB fetch resolves, instead of all four waiting for the slowest.

`generateMetadata` in these pages awaits the same details fetch. That's fine: Next memoizes identical GET `fetch` calls across `generateMetadata` and the page within one request. Leave it as it is.

### Step 5: client-side navigation for chat links

In [AssistantMessage.tsx](src/Components/ui/AssistantMessage.tsx), pass `components` to `<Markdown>`:

```tsx
components={{
  a: ({ href = "", children }) =>
    href.startsWith("/") ? <Link href={href}>{children}</Link> : <a href={href} target="_blank" rel="noreferrer">{children}</a>,
}}
```

Using `react-markdown@8`, strip the `node` prop before spreading any other props onto the element. Keep the `.chatLink a:hover` underline working: `next/link` renders an `<a>`, so it should.

### Step 6: replace redirect-only server actions with client navigation

**Search filters.** `Filters` must stay a server component, because it renders the async server component `LangSelect`, which fetches languages.

- Extract only the `<form>` into a new client component `src/Components/FiltersForm.tsx`. Render `<LangSelect defaultValue={language} />` in `Filters` and pass it into `FiltersForm` as a prop or as `children`.
- In `FiltersForm`:
  - `const router = useRouter()` and `const [isPending, startTransition] = useTransition()`.
  - `onSubmit`: `e.preventDefault()`, build `FormData` from `e.currentTarget`, and add `btn` from `(e.nativeEvent as SubmitEvent).submitter`. The two submit buttons carry `name="btn"`, and `new FormData(form)` alone doesn't include the submitter; `new FormData(form, submitter)` does.
  - Build the URL and call `startTransition(() => router.push(url))`.
- Move the URL-building logic out of `fetchMovies` into a shared helper in [lib/utils.ts](src/lib/utils.ts), such as `buildSearchURL(values)`. It should parse `values` with `movieFilterSchema` exactly as `fetchMovies` does today. Then delete `fetchMovies` from [actions.ts](src/app/actions.ts) if nothing else uses it.
- [SubmitBtn.tsx](src/Components/ui/SubmitBtn.tsx) uses `useFormStatus`, which doesn't fire for `onSubmit` handlers. Give it a `pending` prop that `FiltersForm` sets from `isPending`, and keep the existing spinner UI. Also fix its broken signature: `props` is currently a second function argument, so it is always `undefined`.

**My-list sorting.** Replace the `<form action={SortList}>` buttons with `<Link>`s:

- Each option links to `/my-list?rating=…&status=…&type=…`, keeping the other two current values.
- Render the active option as the styled, non-link `ListSortBtn` (disabled). Render the others as `Link`s with the same classes.
- Links get prefetching and the keyed Suspense from step 3 for free.
- Delete `SortList` and the hidden `curr*` inputs.

Leave the "Refresh list" form at [my-list/page.tsx:93-103](src/app/my-list/page.tsx#L93-L103) as it is.

### Step 7: fewer session lookups

- In [auth.ts](src/auth.ts), add `export const getSession = cache(() => auth())`, with `cache` imported from `react`.
  - **Don't** wrap or replace the exported `auth` itself: [middleware.ts](src/middleware.ts) uses it as the middleware wrapper.
  - Replace `await auth()` with `await getSession()` in [layout.tsx](src/app/layout.tsx), [MovieCard.tsx](src/Components/ui/MovieCard.tsx), [Details.tsx](src/Components/Details.tsx), [my-list/page.tsx](src/app/my-list/page.tsx) and the new `MyListItems`.
  - Leave `DeleteUser` in [actions.ts](src/app/actions.ts) unchanged.
- In [middleware.ts](src/middleware.ts), add `export const config = { matcher: ["/my-list/:path*"] }`. The `authorized` callback only protects `/my-list`, and the page redirects on its own too.

### Step 8: mobile nav fix

In [Navbar.tsx:94](src/Components/Navbar.tsx#L94), change `href="/mylist"` to `href="/my-list"`.

---

## 3. Out of scope, but flag it to the user

- `getNewURL` in [lib/utils.ts](src/lib/utils.ts) writes `adult: "false"` when `adult` is true, so pagination drops the "include adult" filter. Don't fix it silently; tell the user.
- The mobile nav `ul` uses `min-[510px]:hidden`, but the toggle button uses `min-[640px]:hidden`.

---

## 4. Constraints

- Match the existing code style. Only add comments that give context the code can't. Run Prettier (`prettier-plugin-tailwindcss`).
- Don't add dependencies.
- Don't upgrade Next.js.
- Don't change the data each page shows, or its markup (other than the Suspense wrappers).

---

## 5. Verification

**Dev mode can't show whether navigation is instant.** `next dev` disables prefetching and compiles routes on demand. Verify with a production build:

1. Run `npm run lint`, `npx tsc --noEmit` and `npm run build`. All must pass.
2. Run `npm run start`. Then, with `playwright-cli` (installed globally) and network throttling (for example Slow 3G, or a CDP latency of 1–2s):
   - Navbar "Manual Search" → the URL changes, and the search skeleton appears in under about 100ms, before the results.
   - Click a movie card → the details skeleton appears immediately, then each section fills in on its own.
   - Pagination and filter "Search movies"/"Search TV shows" → the filters stay visible, the grid is replaced by the skeleton, and the submit button shows its spinner.
   - My list (signed in) → sort links switch instantly, with row skeletons.
   - An AI chat reply link (`/search?...`) → a soft navigation: no full reload, and the navbar doesn't flash.
   - The mobile nav "My list" works.
   - Signed out, `/my-list` still redirects to sign-in.
3. Compare screenshots of each skeleton with the loaded page at desktop and at 375px width. The layout must not shift noticeably when content replaces the skeleton.
4. Check the server logs: one session lookup per request instead of one per card.
