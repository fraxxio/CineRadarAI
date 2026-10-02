# B: Deepen a TMDB module in `infra/`

Status: proposed · Depends on: A step 1 (`infra/` exists). It can also be done before A in `src/lib/tmdb/` and moved later. · Related: [A](A-feature-modules.md), [C](C-my-list-module.md)

## Goal

Every request to TMDB goes through one module, `src/infra/tmdb`. That module owns:

- the base URL and the bearer token
- query-string building and encoding
- the choice between the `discover` and `search` endpoints
- the error policy
- the response types
- the image and watch URLs

Feature modules ask for what they need, such as a title, its images or a page of results. They do not build HTTP requests.

## What's wrong today

There are eight copies of the same fetch boilerplate. Each one repeats the options object, the try / `!ok` / throw / `console.error` block, and returns `any`:

| Call site | Endpoint |
|---|---|
| `Components/SearchResults.tsx` (`fetchMovies`) | `/{discover\|search}/{movie\|tv}?query&include_adult&language&page&year` |
| `Components/ui/LangSelect.tsx` (`getLanguages`) | `/configuration/languages` |
| `Components/Details.tsx` (`fetchDetails`) | `/{type}/{id}?language=en-US` |
| `Components/Gallery.tsx` (`fetchGallery`) | `/{type}/{id}/images` |
| `Components/Trailer.tsx` | `/{type}/{id}/videos?language=en-US` |
| `Components/Reviews.tsx` | `/{type}/{id}/reviews?language=en-US&page=1` |
| `app/search/movie/[id]/page.tsx` (`generateMetadata`) | `/movie/{id}?language=en-US`, the same request as Details |
| `app/search/tv/[id]/page.tsx` (`generateMetadata`) | `/tv/{id}?language=en-US`, the same request as Details |

TMDB image URLs are hardcoded in six places:
- `https://image.tmdb.org/t/p/w500`: Details, MovieCard, ListCard, Reviews
- `w780` and `w1280`: Gallery
- the watch link `https://www.themoviedb.org/{type}/{id}/watch`: Details

The fetch helpers also contain `"use server"` inside the function body. That turns them into server-action references, which is not what they are. They are plain server-side functions.

Response types are copied per component, for example `DetailsProps`, `GalleryProps` and the inline type in MovieCard. Some are ambient globals that nothing imports: `Results`, `FetchedData`, `Language`.

## Suggested shape

This is a starting point, not a fixed interface. The aim is a **small interface with a lot behind it**.

```
src/infra/tmdb/
  index.ts        client-safe: types + URL builders (no fetch, no env)
  server.ts       server-only: the queries
  client.ts       internal: tmdbFetch<T>(path, params) — not exported from the module
  types.ts        response types (only the fields we use)
  urls.ts         tmdbImageUrl, tmdbWatchUrl
  server.test.ts  unit tests (node), using tests/helpers/tmdb.ts mockTmdb
  urls.test.ts
```

```ts
// index.ts — safe anywhere
export type MediaType = "movie" | "tv";
export type { TitleSummary, TitleDetails, TitleImages, TitleVideos, TitleReviews, Language, Paged } from "./types";
export function tmdbImageUrl(path: string | null | undefined, size: "w500" | "w780" | "w1280"): string | null;
export function tmdbWatchUrl(type: MediaType, id: number): string;

// server.ts — server only
export function findTitles(p: {
  mediaType: MediaType;
  query?: string;          // present → /search, absent → /discover (TMDB knowledge lives here)
  language?: string;
  year?: string;
  includeAdult?: boolean;
  page?: string | number;
}): Promise<Paged<TitleSummary>>;
export function getTitle(type: MediaType, id: number | string): Promise<TitleDetails>;
export function getTitleImages(type: MediaType, id: number): Promise<TitleImages>;
export function getTitleVideos(type: MediaType, id: number): Promise<TitleVideos>;
export function getTitleReviews(type: MediaType, id: number, page?: number): Promise<TitleReviews>;
export function getLanguages(): Promise<Language[]>;
export class TmdbError extends Error { status: number; path: string }
```

What stays out of the module:
- **Search query preprocessing** (`split(" ").join("|")` in SearchResults): it's search behaviour, not TMDB transport, so it stays in `modules/search`.
- **`Gallery`'s `slice(0, 9)`:** presentation, stays in the component.
- **Page titles** (`${details.title} | CineRadar`): stay in the route or title module.

Two approaches are open for movie vs TV fields: TV has `name` / `first_air_date` / `number_of_seasons` where movies have `title` / `release_date` / `runtime`.
1. **Keep the raw shapes** (`TitleDetails = MovieDetails | TvDetails`) and let `Details` branch as it does now. This is the smaller change and the recommended one for B.
2. **Normalise in the module**, for example `displayTitle` and `releaseDate`. That makes the module deeper, but it changes component code and fits better with E (collapse the movie/tv pages).

## How to do it

1. **Create the module with tests first.**
   - Write `client.ts` with `tmdbFetch<T>(path, params)`. It should:
     - read `process.env.TMDB_BASE_URL` and `TMDB_ACCESS_TOKEN` **inside the function** (see "Watch out for")
     - build the query with `URLSearchParams`
     - send the same `accept` and `Authorization` headers as today
     - throw `TmdbError` on `!ok`
     - log once
   - Unit-test `findTitles` in `server.test.ts` with `mockTmdb` / `lastTmdbUrl` from `tests/helpers/tmdb.ts`:
     - with a query it calls `/search`; without one it calls `/discover`
     - `&`, `#` and `?` in the query are encoded
     - `year` is only sent when set
     - `include_adult`, `language` and `page` are passed through
     - the bearer header is sent
     - a 500 response throws `TmdbError` with its status
   - Test the URL builders with null and empty paths.
2. **Migrate the call sites one per commit,** running the test suite each time:
   1. `Details` and both `generateMetadata` functions (they share `getTitle`)
   2. `Gallery`, `Trailer`, `Reviews`
   3. `SearchResults`
   4. `LangSelect`
3. **Replace the hardcoded image and watch URLs** with `tmdbImageUrl` / `tmdbWatchUrl`: Details, MovieCard, ListCard, Reviews, Gallery. Keep `next.config.mjs` `remotePatterns` as it is.
4. **Delete the old types:** `fetchMoviesProps`, `Results`, `FetchedData`, `Language` and the per-component response prop types, replaced by imports from `@/infra/tmdb`. Remove every `"use server"` inside function bodies.
5. **Optional:** `import "server-only"` at the top of `server.ts` and `client.ts`. See "Watch out for".

## Tests

- **New:** `infra/tmdb/server.test.ts` and `urls.test.ts` (unit project, node). This is the main test surface for URL building and error handling. It replaces the URL assertions that are currently spread across component tests.
- **Existing component and server-component tests** (`SearchResults`, `Details`, `Gallery`, `Reviews`, `Trailer`, `LangSelect`, `MovieCard`, `detail-metadata`) mock `globalThis.fetch` by pathname. They keep working unchanged as long as the URLs stay the same. Once the module exists, URL-shape assertions such as `SearchResults.test.tsx:76` (`include_adult`) can move into `server.test.ts`. Component tests then only check rendering.
- **E2E** runs against `tests/e2e/mocks/tmdb-server.mjs`. It routes on pathname (`/discover/(movie|tv)`, `/search/(movie|tv)`, `/(movie|tv)/:id(/videos|images|reviews)?`, `/configuration/languages`) and records every request at `/__requests`. Unchanged paths keep it working.

The seam here is HTTP. Production uses the real TMDB. Tests use a fetch spy (vitest) or the local mock server (e2e). Both substitutes already exist, so no new test doubles are needed.

## Watch out for

- **URL parity.** Keep paths and query parameters exactly the same unless you change them on purpose:
  - Today `SearchResults` builds the URL by string concatenation. When a value is `undefined`, the URL contains literal text like `include_adult=undefined` or `language=undefined`.
  - `URLSearchParams` that skips undefined values will change those URLs.
  - That is probably harmless, since the search page defaults `language` to `"en"`. But check `SearchResults.test.tsx` and any e2e assertion that reads `/__requests` before and after.
  - Do the parity change in its own commit if you make it.
- **Next's fetch caching.** In Next 14, `fetch` in server components defaults to the Data Cache (`force-cache`) and is memoised per request. That is also why the metadata fetch and the Details fetch cost one network call today.
  - Keep using `fetch` with the same options so the behaviour doesn't change.
  - Don't add `cache: "no-store"` or `next: { revalidate }` as part of this refactor. Choosing a revalidation policy is a separate decision.
  - Don't swap `fetch` for an SDK or another HTTP client, which would lose the caching without any warning.
- **Read env vars at call time,** not at module load. Vitest sets `TMDB_BASE_URL=https://tmdb.test/3` in config, and tests may `vi.stubEnv`, with `unstubEnvs: true` restoring it after each test. A `const BASE = process.env.TMDB_BASE_URL` at module scope freezes the first value.
- **`server-only` in vitest.** The `server-only` package throws when it is imported outside the React server condition, which includes vitest's node and jsdom environments. If you add it, alias it to an empty module in `vitest.config.mts` (`alias: { "server-only": "<empty file>" }`). It isn't installed as a direct dependency today. The token isn't `NEXT_PUBLIC_` so it can't leak to the client anyway, which makes this a guard rather than a fix.
- **Removing `"use server"` is correct.** Those functions are only called from server components. Check that none of them is passed as a prop to a client component before deleting the directive. Grep finds none today.
- **Error behaviour.**
  - Today any TMDB failure throws, and `app/error.tsx` catches it.
  - Keep that. Changing an unknown id (TMDB 404) to `notFound()` is a sensible follow-up, but it is a behaviour change with its own e2e impact.
  - If tests spy on `console.error` for a specific message, update the expected text.
- **Mixed `id` types.** The route pages pass `params.id` (a string at runtime, typed as `number`) while components type it as `number`. Accept `number | string` in the module, or parse once in the route. Don't spread `Number(...)` calls across modules.
- **Interface creep.** Don't add a generic `tmdb.get(path)` escape hatch to the public interface. Once callers can build paths themselves, the module is shallow again.

## Done when

- `grep -rn "TMDB_ACCESS_TOKEN\|TMDB_BASE_URL\|image.tmdb.org\|themoviedb.org" src` only matches inside `src/infra/tmdb/`. `next.config.mjs` is outside `src/` and keeps its `remotePatterns`.
- No `"use server"` directive appears inside a function body.
- `infra/tmdb` has its own unit tests. All existing component tests and e2e specs pass unchanged, or with deliberate, separately committed URL-parity edits.
- `npm run lint && npx tsc --noEmit && npm run typecheck:tests && npm run test:run && npm run build && npm run test:e2e` passes.
