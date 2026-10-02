# C: Deepen the My List module

Status: proposed · Depends on: A (`modules/my-list` exists). Easier after B (`tmdbImageUrl`, `MediaType`). · Related: [A](A-feature-modules.md), [B](B-tmdb-module.md)

## Goal

One module owns everything about a user's list:
- reading entries
- adding or updating an entry
- removing an entry
- clearing the list
- deciding which entries count as "the same entry"
- the allowed statuses
- the sort and filter view
- the read-modify-write consistency of the stored JSON

Routes, server actions and components call that module. They hold none of these rules themselves.

## What's wrong today

`lib/myList.ts` only reads. Everything else is spread across these places:

| Concern | Where it lives now |
|---|---|
| Add or update an entry (read-modify-write the JSON blob) | `app/api/add-to-list/route.ts` |
| Remove an entry (the same read-modify-write) | `app/api/remove-from-list/route.ts`. It reads `movieId` and `type` from **request headers** |
| Clear the list on account deletion | `app/actions.ts` `DeleteUser`, via `tx.delete(lists)` |
| "Same entry" means same `movieId` **and** same `type` | Copied in both routes (bug B4) |
| Auth check and 401 | Copied in both routes |
| Status values `"Planning to watch" \| "Completed" \| "Watching"` | Route zod schema, `ListTypeSelect`, `lib/myList.ts` (url slug → label), `ListCard` (icons) |
| Entry shape `{image,name,movieId,rating,status,type}` | `db/schema/lists.ts`, `lib/myList.ts`, `ListCard.tsx`, `tests/helpers/db.ts`, `tests/e2e/helpers/db.ts` |
| Session-user shape `{id,name,email,image}` | Redeclared in AddToListBtn, EditListBtn, ListCard (plus Navbar and AuthBtn) |
| Add/Edit dialog | `AddToListBtn.tsx` and `EditListBtn.tsx`, which differ only in trigger, copy and `router.refresh()` |

Concrete defects that have nowhere to be fixed today:

- **Lost updates.** Both routes run SELECT, then modify the array in JS, then UPDATE, with no transaction. Two concurrent saves can overwrite each other.
- **Duplicate rows.** `lists.userId` is not unique. Two concurrent *first* saves can insert two rows, and `getListMovies` reads `result[0]`.
- **Status not enforced.** `status` and `type` are typed `string` in the schema, so nothing stops a bad value once it's past the route's zod.
- **Dead or wrong client code in `DeleteListBtn`.** It takes `userId` and never sends it, checks `userId === undefined` (which can't happen), and toasts "Failed to add" on a remove.

## Suggested shape

This is a starting point; the names are open for discussion.

```
src/modules/my-list/
  index.ts            client-safe: types, LIST_STATUSES, components
  server.ts           server-only: the list store
  schema.ts           the `lists` drizzle table (moved from infra/db/schema/lists.ts)
  entry.ts            ListEntry, EntryKey, LIST_STATUSES, entry input zod schema
  view.ts             viewEntries(entries, view): pure filter + sort (was filteredMovies)
  store.ts            DB access: getEntries / saveEntry / removeEntry / clearList
  components/         ListEntryDialog, RemoveEntryButton, ListCard, MyListItems, sort controls, StatusSelect, RatingSelect
  skeletons/
  testing/listForm.tsx
  store.int.test.ts  view.test.ts  components/*.test.tsx
```

```ts
// entry.ts — one definition of the domain
export const LIST_STATUSES = [
  { value: "Planning to watch", slug: "planning" },
  { value: "Watching",          slug: "watching" },
  { value: "Completed",         slug: "completed" },
] as const;
export type ListStatus = (typeof LIST_STATUSES)[number]["value"];
export type EntryKey = { movieId: number; type: MediaType };        // MediaType from @/infra/tmdb (B) or local
export type ListEntry = EntryKey & {
  name: string;
  image: string;            // "" when TMDB has no poster
  status: ListStatus;
  rating: number;           // 0 = not rated
};
export const entryInput = z.object({ ... });                       // moved from the add-to-list route

// server.ts — the interface routes/actions/pages use
export const getEntries: (userId: string) => Promise<ListEntry[]>; // React cache()
export function saveEntry(userId: string, entry: ListEntry): Promise<void>;   // upsert on EntryKey
export function removeEntry(userId: string, key: EntryKey): Promise<void>;
export function clearList(userId: string, tx?: Tx): Promise<void>;           // for account deletion
export { viewEntries, type ListView } from "./view";
```

Design choices in this sketch:

- **The store takes `userId`; it doesn't read the session.** Routes and actions resolve the user (`auth()` → 401) and pass the id in. Integration tests can then call the store without mocking auth, and the B1 property ("identity only comes from the session") stays in one place: the adapter.
- **Entry identity is `EntryKey`, used by every operation.** The `movieId && type` rule exists once, inside `store.ts`.
- **`LIST_STATUSES` keeps the stored labels as values.** The DB holds `"Planning to watch"` and the other labels. URL slugs are a separate field.
- **`clearList` accepts an optional transaction,** so `DeleteUser` can keep deleting accounts, sessions, list and user atomically. It's a small leak across the seam, accepted because account deletion must be all-or-nothing.

## Transport: keep routes or switch to server actions

**Option 1, recommended for C: keep `PUT /api/add-to-list` and `DELETE /api/remove-from-list` as thin adapters.** Each route does the following and nothing else:
1. auth
2. parse with `entryInput`
3. call the store
4. `revalidatePath`
5. map the result to a response

This keeps `tests/e2e/security.spec.ts` (B1, which calls both routes directly) and the route integration tests meaningful with minimal edits.

**Option 2, later: server actions in `modules/my-list/actions.ts`.** This removes client `fetch`, JSON/header plumbing and `router.refresh()`. But it rewrites the route integration tests and the e2e security tests. Playwright can't easily call a server action directly, so B1 would need a different proof. Because the store is a deep module, this switch only touches the adapters, so it can wait.

## How to do it

One commit per step. Run the suite after each.

1. **Define the domain once.**
   - Create `entry.ts` (types, `LIST_STATUSES`, `entryInput`).
   - Point everything at it:
     - the add-to-list route's zod schema
     - `ListTypeSelect` (rename to `StatusSelect`)
     - `filteredMovies`
     - `ListCard` (props and the status → icon map)
     - `tests/helpers/factories.ts` `makeMovie`
   - Use `next-auth`'s `Session["user"]` instead of the redeclared user shapes.
2. **Move the table into the module.**
   - `infra/db/schema/lists.ts` → `modules/my-list/schema.ts`, with `movies: blob(...).$type<ListEntry[]>()`.
   - Set the drizzle `schema` to an array in **both** `drizzle.config.ts` and `drizzle.test.config.ts`: `["./src/infra/db/schema/*", "./src/modules/*/schema.ts"]`.
   - Run `drizzle-kit generate` and confirm it produces **no** migration. A pure move must not change the SQL.
   - Update `tests/e2e/helpers/db.ts`, which uses a relative import of the schema.
3. **Build the store, test-first.** Write `store.int.test.ts` against the real libsql test DB, using the existing `seedUser` / `seedList` / `getMovies` / `forceFailure` helpers. Port the cases from the route tests:
   - insert when the user has no row
   - append
   - replace on the same key
   - a TV show with the same id doesn't overwrite a movie (B4)
   - remove only the matching key
   - remove when no row exists
   - clear
   - a DB failure throws (`forceFailure`)

   Then add one new test: **two concurrent `saveEntry` calls for different titles both survive**, using `Promise.all`. Implement the store with the read-modify-write inside `db.transaction(...)`.
4. **Make the routes adapters.** They call `saveEntry` / `removeEntry`. `remove-from-list` keeps accepting the header-based request the security spec sends for now. Moving to a JSON body is fine, but update `DeleteListBtn` and `security.spec.ts` in the same commit. Route tests shrink to auth, validation, mapping and revalidation; data-behaviour cases move to `store.int.test.ts`.
5. **`DeleteUser` uses `clearList(userId, tx)`.** The account module stops importing the `lists` table.
6. **Merge the dialogs.**
   - Replace `AddToListBtn` and `EditListBtn` with one `ListEntryDialog`. Its trigger, copy and refresh-after-save are props or a `mode`.
   - Rename `DeleteListBtn` to `RemoveEntryButton` and drop its dead `userId` prop and check.
   - Keep `testing/listForm.tsx` `describeListForm` as the shared contract and run it against both modes. It already captures the behaviour the two dialogs share.
7. **Tidy the read side.** `MyListItems` and `ListLength` each call `getSession()` and `getEntries()`, which React `cache` dedupes. Optionally compute the view once in the page and pass it down. Fold `ListSortBtn` into `ListSortLink` if it is still only a styled button.

## Watch out for

- **Stored data.**
  - Don't change the status strings, field names (`movieId`, `name`, `image`, `rating`, `type`) or `rating: 0 = unrated` encoding. Production rows in Turso use them.
  - Rows written before the zod validation existed may have odd values. When reading, tolerate unknown statuses and types: show them rather than crash, and don't drop entries silently.
- **Transactions on libsql.** `@libsql/client`'s `transaction()` defaults to `"write"` mode (`BEGIN IMMEDIATE`), so writers are serialised. That is what fixes the lost-update race.
  - Keep the transaction short: one select, one write, no network calls inside. Remote Turso transactions hold a connection open.
  - The `forceFailure` triggers in tests raise inside the transaction. Check that the store still surfaces the error and the route still answers `{ addToListResult: "fail" }`.
- **Duplicate rows per user.** A unique index on `lists.userId` would close the first-insert race fully. Before adding it, check production for users with more than one row; the migration fails if any exist. Treat it as a separate, deliberate migration, not part of the refactor.
- **Response contract.**
  - Clients and tests read `{ addToListResult: "success" | "fail" }`, and the remove route returns the same key.
  - DB failures currently answer **HTTP 200** with `"fail"`; integration tests assert the body, not the status.
  - Changing to 500 or renaming the key is fine, but do it in its own commit with the client and tests updated together.
- **Cache invalidation.** Routes call `revalidatePath("/my-list", "page")` and the Edit/Delete dialogs also call `router.refresh()`. Keep both until you switch to server actions, then drop the refresh.
- **Cross-module imports.** `MovieCard` (search) and `Details` (title) render the add dialog. They import it from `@/modules/my-list` (index), never from a deep path. Their tests currently `vi.mock("@/Components/ui/AddToListBtn")`; that mock target moves to `@/modules/my-list`, with a partial mock so other exports stay real.
- **`MovieCard` calls `getSession()` per card** only to pass `user` to the add dialog, which uses it for the "You need to be logged in!" toast. If the dialog reads that from the save response (401 → toast) or from a `signedIn` boolean, the session prop drilling goes away. Behaviour must stay the same: anonymous users can open the dialog and get the warning on submit.
- **`schema.ts` in a module, `infra/` imports nothing from modules.** The `users` table stays in `infra/db/schema`. `lists.ts` references `users.id` (module → infra, allowed). The NextAuth `DrizzleAdapter` only needs the auth tables, so nothing in infra needs `lists`.
- **The `react` `cache` shim in tests** (`tests/setup/shared.ts`) makes `cache` the identity function, so `getEntries` isn't memoised in tests. Don't write tests that depend on dedupe.

## Done when

- `lists` is imported only inside `src/modules/my-list/`. Tests and e2e helpers are the exception.
- The entry identity rule (`movieId` + `type`), the status values and the entry type are each defined once.
- There's one dialog for add and edit. `AddToListBtn.tsx` and `EditListBtn.tsx` are gone.
- `store.int.test.ts` covers every store operation, including the concurrent-save case.
- `npm run lint && npx tsc --noEmit && npm run typecheck:tests && npm run test:run && npm run build && npm run test:e2e` passes, with `security.spec.ts` unchanged or deliberately updated.

## Open decisions

- Option 1 or 2 for transport. Option 1 is recommended now.
- Whether to add the unique index on `lists.userId` after checking production data.
- Longer term: normalise the JSON blob into a `list_entries` table with `unique(userId, movieId, type)`. The store's interface wouldn't change, which is the point of this candidate. It would need a data migration on Turso.
