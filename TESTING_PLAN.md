# CineRadar AI: Test Coverage Plan

This file lists what in the app can be covered by automated tests and what each test should check. It does not say how to implement them. The suggested tools are:

- **Vitest** (with React Testing Library and jsdom/happy-dom) for unit tests and integration tests (API routes, server actions, client components).
- **Playwright** for end-to-end tests that run against a real `next dev` / `next start` server.

Priority levels:

- **P1**: core logic, security, or data integrity. Write these first.
- **P2**: important UI behaviour.
- **P3**: nice to have.

---

## 0. Known bugs found during the survey

Some of the tests below should **fail against the current code**. Write them anyway, then decide whether to fix the code or mark the test as `todo`/`fails`.

| # | Where | Problem |
|---|-------|---------|
| B1 | [src/app/api/add-to-list/route.ts](src/app/api/add-to-list/route.ts) | There is no session check. `userId` comes from the request body, so anyone can write to another user's list. |
| B2 | [src/app/api/remove-from-list/route.ts](src/app/api/remove-from-list/route.ts) | There is no session check. `userId` comes from a request header, so anyone can delete from another user's list. |
| B3 | [src/app/actions.ts](src/app/actions.ts) `DeleteUser` | It deletes the user whose id is in the hidden form field `id`, not `session.user.id`. Any logged-in user can delete any account. |
| B4 | add-to-list / remove-from-list | List entries are matched by `movieId` only. TMDB movie ids and TV ids can be the same number, so adding a TV show can overwrite a movie with that id, and removing one removes both. |
| B5 | [src/Components/ui/Pages.tsx](src/Components/ui/Pages.tsx) | On the last page (when total pages < 500), "Next" is still enabled and links past the end. The next-page buttons are not capped at `maxPages` either: on page 2 of 3 it shows buttons for pages 3 and 4. |
| B6 | [src/Components/SearchResults.tsx](src/Components/SearchResults.tsx) `fetchMovies` | The query is not URL-encoded. A search containing `&`, `#` or `?` (e.g. "Tom & Jerry") breaks the TMDB request URL. |
| B7 | [src/app/search/page.tsx](src/app/search/page.tsx) `getTitle` | With no query, the heading is always "Trending movies", even when browsing TV (`btn=tv`). This is minor. |
| B8 | add-to-list route | The DB `select` runs outside the `try`, so a DB failure becomes an unhandled 500 instead of `{ addToListResult: "fail" }`. This is minor. |

---

## 1. Unit tests: pure logic (Vitest, P1)

These have no external dependencies and give the best value for the effort.

### 1.1 [src/lib/utils.ts](src/lib/utils.ts)

**`buildSearchURL(values, page?)`**
- Returns a URL starting with `/search?`.
- Trims whitespace around `query`.
- Leaves out empty or undefined fields (`query: ""`, `language: ""`, `year: ""`).
- `adult` is included as `adult=true` only when truthy and left out otherwise.
- `btn` accepts only `movie` / `tv`. Any other value makes the zod parse throw.
- `page` is included when passed, including `0`, and left out when `undefined`.
- Special characters in `query` (`&`, `#`, spaces, unicode) are encoded correctly.
- Unknown extra keys in `values` are ignored.
- Edge case: `adult: "false"` (a string) is coerced to `true` by `z.coerce.boolean()`. Record this behaviour in a test.

**`formatCurrency(amount)`**
- `0` → `$0`, `999` → `$999`.
- `1000` → `$1.0k`, `1_500_000` → `$1.5M`, `2_300_000_000` → `$2.3B`.
- Boundary values: `999_999` (currently `$1000.0k`; record or fix), `1e6`, `1e9`.

**`cn(...)`**
- Merges conflicting Tailwind classes (the last one wins) and drops falsy values. One or two quick tests are enough.

### 1.2 [src/lib/validation.ts](src/lib/validation.ts): `movieFilterSchema`
- Accepts an empty object.
- Accepts every valid field.
- Rejects an invalid `btn`.
- Coerces `adult` to a boolean.

### 1.3 [src/lib/myList.ts](src/lib/myList.ts): `filteredMovies`
- `type: "both"` keeps everything. `movie` / `tv` keep only that type.
- `status` maps `completed` → "Completed", `planning` → "Planning to watch", `watching` → "Watching", and `all` keeps everything.
- Type and status filters combine correctly.
- `rating: "asc"` / `"desc"` sort correctly. Unrated items (`rating: 0`) end up first or last.
- **The input array is not mutated.** The comment in the code says this matters because the array is cached. Check that the original order is unchanged afterwards.
- An empty input returns an empty array.

### 1.4 [src/lib/loaderWords.ts](src/lib/loaderWords.ts): `shuffle`
- Returns a new array (not the same reference) with the same length and elements.
- Does not mutate the input.
- Is deterministic when `Math.random` is stubbed.
- Handles empty and single-item arrays.

### 1.5 [src/lib/chatConfig.ts](src/lib/chatConfig.ts)
- `buildSystemInstruction(date)` includes the given date as `YYYY-MM-DD`.
- The instruction contains the link formats that the rest of the app relies on (`/search?query=...&btn=movie&year=...` and `&btn=tv`). This guards against accidental prompt edits that would break the links in chat answers.
- `CHAT_MODEL` falls back to the default when `GEMINI_MODEL` is unset and uses the env value when set.

### 1.6 [src/lib/recaptcha.ts](src/lib/recaptcha.ts): `isRecaptchaEnabled`
- Returns `true` only when **both** `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY` are set, and `false` for the other three combinations.

### 1.7 [src/auth.ts](src/auth.ts): `authConfig.callbacks`
`authConfig` is exported, so the callbacks can be called directly. Mock `@/db`.
- `authorized`: a logged-out user on `/my-list` or `/my-list?type=tv` gets a redirect to `/api/auth/signin` with `callbackUrl` set to the original URL.
- `authorized`: a logged-in user on `/my-list` gets `true`.
- `authorized`: public paths (`/`, `/search`, `/about`) return `true` for anyone.
- `session`: copies `user.id` onto `session.user.id`.

### 1.8 [src/app/search/page.tsx](src/app/search/page.tsx): `generateMetadata`
- With no query, the title is `Manual search | CineRadar`.
- With a query, the title is `Results for: X | CineRadar`.
- Language is shown uppercased, year is appended, and "including adult." is added when `adult=true`.
- (If `getTitle` gets exported, test it directly too, including B7.)

---

## 2. Integration tests: API routes and server actions (Vitest, P1)

Call the exported route handlers directly with a `Request`. Mock the boundaries:
- `next/cache` (`revalidatePath`)
- `@/auth` (`auth()`)
- `next/navigation` (`redirect`)
- `@google/genai`
- global `fetch`

For the DB, a real throw-away SQLite/libsql database (`file:` URL or in-memory) with the Drizzle schema is better than mocking Drizzle. Note that `drizzle/` only contains migration `0001`; migration `0000` is missing, so the schema can't be rebuilt from the migrations alone.

### 2.1 `PUT /api/add-to-list`: [route.ts](src/app/api/add-to-list/route.ts)
- For a user with no `lists` row, it inserts a new row containing just that movie.
- For a user with an existing row and a new movie, it appends the movie.
- For a movie already in the list, it replaces the entry (updates status/rating) instead of duplicating it.
- `rating: ""` is stored as `0`, and a numeric string is stored as a number.
- `movieId` is stored as a number.
- It returns `{ addToListResult: "success" }` and calls `revalidatePath("/my-list", "page")`.
- It returns `{ addToListResult: "fail" }` when the DB update or insert throws.
- A DB failure during the initial select (B8).
- Adding a TV show whose id matches a movie already in the list must not overwrite the movie (B4, currently fails).
- A request without a valid session, or with a `userId` different from the session user, is rejected (B1, currently fails).
- (Optional) Invalid payloads (missing `status`, bad `type`, rating out of 1–10) are rejected. There is no validation right now.

### 2.2 `DELETE /api/remove-from-list`: [route.ts](src/app/api/remove-from-list/route.ts)
- It removes the matching `movieId` and leaves the other entries untouched.
- It returns `fail` when the user has no list row.
- It returns `success` (no-op) when the movie isn't in the list.
- It returns `fail` when the DB update throws.
- It calls `revalidatePath` on success.
- Removing a movie must not remove a TV show with the same id (B4, currently fails).
- It rejects requests without a matching session (B2, currently fails).

### 2.3 `POST /api/assistant`: [route.ts](src/app/api/assistant/route.ts)
Mock `GoogleGenAI.interactions.create` so it returns an async iterable of events.
- Returns 503 when `AI_CHAT_ENABLED !== "true"`.
- Returns 400 when `content` is missing, not a string, only whitespace, or longer than `MAX_PROMPT_LENGTH`. Exactly `MAX_PROMPT_LENGTH` characters is accepted.
- Returns 400 when `previousInteractionId` is not a string (a number or an object). `null` or `undefined` is accepted.
- Passes `previousInteractionId`, the model, the system instruction and `stream: true` to Gemini.
- Returns 502 when `interactions.create` throws.
- The response has `Content-Type: application/x-ndjson`.
- Maps the stream events to NDJSON lines:
  - `interaction.created` → `{type:"start", interactionId}`
  - `step.delta` with `delta.type === "text"` → `{type:"delta", text}`
  - Non-text deltas (e.g. thoughts) are skipped.
  - `interaction.completed` with status `completed` → `{type:"done", interactionId}`, and any other status → `{type:"error"}`
  - An `error` event → `{type:"error"}`
- If the iterator throws midway, an `{type:"error"}` line is sent and the stream closes cleanly.
- Every line is valid JSON terminated by `\n`.

### 2.4 `POST /api/recaptcha`: [route.ts](src/app/api/recaptcha/route.ts)
Mock global `fetch`.
- Returns 503 when AI chat is disabled.
- Returns 404 when reCAPTCHA isn't configured.
- Calls Google siteverify with the secret and the token.
- Returns `{success:true, score}` when Google says `success: true` and `score > 0.5`.
- Returns `{success:false}` when the score is `<= 0.5` (test exactly `0.5`), when `success` is false, when the Google response is non-OK, or when `fetch` throws.

### 2.5 Server action `DeleteUser`: [src/app/actions.ts](src/app/actions.ts)
- Returns `null` without touching the DB when there is no session.
- When `verifyInput !== "Delete account"`, it redirects to `/?deleteAcc=fail` and deletes nothing.
- With the correct confirmation text, it deletes the user's accounts, sessions, list and user row in one transaction, then redirects to `/?deleteAcc=success`.
- When the transaction fails, it redirects to `/?deleteAcc=fail`, and the rollback leaves all rows in place.
- It must only ever delete the **session** user, even if the form `id` holds another user's id (B3, currently fails).

### 2.6 `getListMovies`: [src/lib/myList.ts](src/lib/myList.ts)
Run against the test DB.
- Returns the stored movies for the user.
- Returns `[]` for a user with no row and for a row with `movies = null`.

---

## 3. Component tests: client components (Vitest + React Testing Library, P1/P2)

Mock `fetch`, `next/navigation` (`useRouter`), `sonner` (`toast`) and `react-google-recaptcha-v3` where needed.

### 3.1 [ChatAssistant](src/Components/ChatAssistant.tsx) (P1, the most complex client logic)
- Shows the greeting message on first render.
- The submit button is disabled while the input is empty, and the input has `maxLength = MAX_PROMPT_LENGTH`.
- On submit, the user message appears immediately, the input clears and becomes disabled, and the thinking loader is shown.
- **Stream parsing:**
  - Deltas are appended to a live message as they arrive.
  - Events split across chunk boundaries (half a JSON line per chunk) are reassembled.
  - Several events in one chunk are all processed.
  - A final line with no trailing newline is still processed.
  - Blank lines are ignored.
- On `done`, the streamed text becomes a permanent assistant message and the loading state ends.
- **Conversation continuity:** the second request sends the `previousInteractionId` returned by the first.
- **Message cap:** only the last 10 messages are kept.
- **Errors:**
  - A non-OK response, a null body, an `{type:"error"}` event, or a stream that ends without `done` shows "Unfortunately an error occurred. Try again later."
  - After a failure where no interaction id was received, the next request sends no `previousInteractionId` (the conversation resets).
  - The error message clears on the next successful submit.
- **reCAPTCHA enabled:**
  - The client calls `executeRecaptcha`, then posts the token to `/api/recaptcha`, then calls `/api/assistant`.
  - When verification returns `success:false`, it shows "Recaptcha failed to verify!", hides it again after about 3 s, and does not call `/api/assistant`.
  - When `executeRecaptcha` isn't ready yet, nothing is sent.
  - The reCAPTCHA legal notice is shown only when reCAPTCHA is enabled.
- **reCAPTCHA disabled:** it goes straight to `/api/assistant`.

### 3.2 [AssistantMessage](src/Components/ui/AssistantMessage.tsx) (P1)
- The label is "You:" for `user` and "CineRadar AI:" with the logo for `assistant`.
- Renders the markdown content (lists, bold, links).
- Internal links (`/search?query=...`) render as normal same-tab links.
- External links (`https://`, `mailto:`, `//host`) get `target="_blank"` and `rel="noreferrer"`.
- **Security:** `[x](javascript:alert(1))` in the model output must not produce a clickable `javascript:` href. Raw HTML in the content is not rendered as HTML.
- When `children` are passed (the loader), they replace the markdown.

### 3.3 [ThinkingLoader](src/Components/ui/ThinkingLoader.tsx) (P3)
- Shows `words[startIndex % words.length]`.
- Moves to the next word every 4 s (use fake timers) and wraps around.
- Clears its interval on unmount.

### 3.4 [ChatSubmitBtn](src/Components/ui/ChatSubmitBtn.tsx) (P3)
- Shows "Submit" normally and "Generating..." while loading.
- Is disabled when `isLoading` or `disabled` is true.

### 3.5 [AddToListBtn](src/Components/ui/AddToListBtn.tsx) (P1)
- Clicking "Add to list" opens the dialog.
- The status select is required and the rating is optional.
- When logged out, submitting shows the "You need to be logged in!" warning toast, makes no fetch call, and closes the dialog.
- When logged in, it sends a `PUT /api/add-to-list` with the correct body (userId, movieId as a string, title, image, status, rating, type).
- On success, it shows a success toast containing the title. On a `fail` result or a network error, it shows an error toast.
- The button shows "Adding..." and is disabled while the request is in flight.
- The dialog closes and the form resets after either outcome.

### 3.6 [EditListBtn](src/Components/ui/EditListBtn.tsx) (P2)
- Same as AddToListBtn but with "updated" wording.
- Calls `router.refresh()` after the request completes.
- Note: it fetches the relative URL `api/add-to-list` with no leading slash, so it only works from a root-level page like `/my-list`. A test should pin the URL it calls, or the code should be fixed to use `/api/...`.

### 3.7 [DeleteListBtn](src/Components/ui/DeleteListBtn.tsx) (P2)
- The confirmation dialog shows the title.
- Confirming sends `DELETE api/remove-from-list` with `userId` / `movieId` headers.
- Success and failure each show the right toast.
- It calls `router.refresh()` and closes the dialog.
- The button shows "Removing..." while the request is in flight.
- (The same relative-URL note as EditListBtn applies.)

### 3.8 [DeleteModal](src/Components/ui/DeleteModal.tsx) / [DeleteModalBtn](src/Components/ui/DeleteModalBtn.tsx) (P2)
- The dialog opens from "Delete my account".
- The confirmation input is required.
- The hidden `id` field holds the user id.
- The button shows the pending state (from `useFormStatus`).

### 3.9 [DeleteResult](src/Components/ui/DeleteResult.tsx) (P2)
- `deleteAcc="success"` gives a success toast and `"fail"` gives an error toast.
- `undefined` or any other value gives no toast.
- (It schedules the toast during render, so a re-render may show the toast twice. Worth a test.)

### 3.10 [FiltersForm](src/Components/FiltersForm.tsx) (P1)
- Clicking "Search movies" pushes `/search?...&btn=movie` and "Search TV shows" pushes `btn=tv`.
- The URL contains the query (trimmed), language, year and `adult=true` only when the checkbox is ticked.
- Empty selects are left out of the URL.
- The buttons show the pending state during the transition.

### 3.11 [Navbar](src/Components/Navbar.tsx) / [AuthBtn](src/Components/AuthBtn.tsx) (P2)
- Logged out, the navbar shows a "Sign In" link to `/signin`.
- Logged in, it shows the profile avatar button.
- Clicking the avatar toggles the dropdown (Delete account, Sign Out). Clicking outside closes it.
- The mobile menu button toggles the menu and X icons and slides the mobile nav in and out.
- The links go to `/search`, `/my-list` and `/about`.

### 3.12 Small presentational components (P3)
- [ListCard](src/Components/ui/ListCard.tsx):
  - Links to `/search/{type}/{movieId}`.
  - Shows "Not rated" when the rating is 0 and the number otherwise.
  - Capitalises the type ("Movie", "Tv").
  - Shows the right icon for each status.
- [ListSortLink](src/Components/ui/ListSortLink.tsx): when active, renders a disabled button (not a link). When inactive, renders a link with the given href.
- [ListTypeSelect](src/Components/ui/ListTypeSelect.tsx) / [RatingSelect](src/Components/ui/RatingSelect.tsx): list the expected options (3 statuses; ratings 1–10) and call the setter on change.
- [SelectYear](src/Components/ui/SelectYear.tsx): options run from the current year down to 1888, with the current year first. Use fake system time.
- [SubmitBtn](src/Components/ui/SubmitBtn.tsx): `name="btn"`, `value=searchTarget`, and a pending state.
- [PageBtn](src/Components/ui/PageBtn.tsx): the link href comes from `buildSearchURL` with the page number, and the button is disabled when `current`.

### 3.13 [Pages](src/Components/ui/Pages.tsx) pagination (P1)
The logic is contained enough to unit-test directly.
- Page 1: "Previous" is disabled and no previous-page buttons are shown.
- Middle page (e.g. 10 of 50): up to 4 page buttons on each side, and the current page is highlighted and disabled.
- Last page (e.g. 3 of 3): "Next" is disabled (B5, currently fails) and no next-page buttons are shown.
- Page 2 of 3: no buttons beyond page 3 (B5, currently fails).
- `totalPages > 500` is capped at 500, and the "Page: X / 500" label is correct.
- Only 1 page: both navigation buttons are disabled.
- Every link keeps the current filters (query, language, year, adult, btn).

---

## 4. Server components with mocked TMDB (Vitest, P2)

These are async server components that call TMDB with `fetch`. They can be tested either by awaiting the component function with a mocked `fetch` and rendering the returned JSX, or through Playwright (section 5) with a mock TMDB server. Components that contain *other* async server components (e.g. SearchResults → MovieCard) are easier to cover with Playwright.

### 4.1 [SearchResults](src/Components/SearchResults.tsx)
- With no query, it calls the TMDB `discover/{btn}` endpoint. With a query, it calls `search/{btn}`.
- Multi-word queries are joined with `|`.
- The request includes `include_adult`, `language`, `page`, and `year` when set.
- The auth header uses `TMDB_ACCESS_TOKEN`.
- Special characters in the query are encoded (B6, currently fails).
- Empty results show "No results with these filters were found."
- A non-OK TMDB response throws, which is caught by [error.tsx](src/app/error.tsx).

### 4.2 [Details](src/Components/Details.tsx)
- Movies show duration, budget and revenue (formatted with `formatCurrency`). TV shows show seasons, first air date and show type.
- Uses `title` for movies and `name` for TV.
- Shows the "No poster." fallback when both `poster_path` and `backdrop_path` are missing.
- Renders the genres list.
- The rating is shown as `x.x / votes`.
- The "Where to watch?" link points to `themoviedb.org/{type}/{id}/watch`.
- Passes the session user to AddToListBtn.

### 4.3 [Trailer](src/Components/Trailer.tsx)
- Embeds the first video with `type === "Trailer"` as a YouTube iframe, and shows the fallback when there is none.
- (Optional) Should it also check `site === "YouTube"`? Right now it doesn't.

### 4.4 [Gallery](src/Components/Gallery.tsx)
- Shows at most 9 images, and the empty-state message when there are none.
- Clicking an image opens the dialog with the larger image and the vote info.

### 4.5 [Reviews](src/Components/Reviews.tsx)
- Shows at most 10 reviews, and the empty-state message when there are none.
- Shows a placeholder icon when `avatar_path` is null and the avatar image otherwise.
- **Security:** review HTML is sanitised. `<script>`, `onerror=` and `javascript:` links are removed by DOMPurify.
- Content longer than 860 characters shows "Hover to reveal".

### 4.6 [MovieCard](src/Components/ui/MovieCard.tsx)
- Links to `/search/{type}/{id}`.
- Shows NoImage when both image paths are null.
- The title falls back from `title` to `name`.
- The rating is formatted to one decimal place.

### 4.7 [LangSelect](src/Components/ui/LangSelect.tsx)
- Renders one option per TMDB language plus the "Choose language" placeholder.
- Throws when TMDB fails.

### 4.8 Detail pages' `generateMetadata`
In [movie/[id]/page.tsx](src/app/search/movie/[id]/page.tsx) and [tv/[id]/page.tsx](src/app/search/tv/[id]/page.tsx):
- The title is `{title} | CineRadar` for movies and `{name} | CineRadar` for TV.
- It throws on a TMDB error.

### 4.9 [Home page](src/app/page.tsx)
This one is synchronous, so it is easy to render.
- `AI_CHAT_ENABLED=true` with reCAPTCHA configured wraps the chat in RecaptchaWrapper.
- `AI_CHAT_ENABLED=true` without reCAPTCHA renders the chat with no wrapper.
- `AI_CHAT_ENABLED` unset shows the "OUT OF ORDER" overlay and the "no longer available" notice, and the chat is `inert`.

---

## 5. End-to-end tests (Playwright, P1/P2)

Setup notes for the implementing agent:
- **TMDB is called server-side**, so Playwright's `page.route` can't intercept it. Point `TMDB_BASE_URL` at a small local mock server that serves fixture JSON. TMDB images load client-side (`images.unoptimized: true`), so those *can* be stubbed with `page.route`.
- **`/api/assistant` and `/api/recaptcha` are called from the browser**, so they can be stubbed with `page.route` (return NDJSON for the assistant). Alternatively, run the real routes against a stubbed Gemini.
- **Auth uses database sessions** (Drizzle adapter). To log in during tests, use a local libsql DB (`DATABASE_URL=file:...`), seed a `user` row and a `session` row, and set the `authjs.session-token` cookie. Don't go through real OAuth.
- Leave the reCAPTCHA keys unset by default. Add a separate project or config for the enabled path if needed.

### 5.1 Navigation and static pages (P2)
- The navbar links reach Home, Manual Search, My list, About and Sign In.
- `/about` renders its headings.
- An unknown route shows the 404 page, and "Return Home" goes to `/`.
- The mobile viewport menu opens and closes.

### 5.2 AI chat on the home page (P1)
- **Chat disabled** (`AI_CHAT_ENABLED` unset): the "OUT OF ORDER" overlay is visible and the input can't be typed into.
- **Chat enabled:**
  - The user types a prompt and submits.
  - The thinking loader appears, then streamed text builds up, then the final message shows as a markdown list.
  - Clicking a recommendation link (`/search?query=...&btn=movie&year=...`) opens the search page with the filters pre-filled.
  - A follow-up message sends the previous interaction id.
  - The error state is shown when the stubbed API returns 500.
  - The input is disabled during generation.
- **reCAPTCHA enabled:** a failed verification shows "Recaptcha failed to verify!" and no assistant call is made.

### 5.3 Manual search (P1)
- `/search` with no query shows the trending (discover) results grid.
- Typing a query, choosing a language and year, ticking adult and clicking "Search movies" updates the URL, keeps the form values after reload, and shows results with the correct heading.
- "Search TV shows" switches to TV results, and the cards link to `/search/tv/{id}`.
- Pagination: going to the next page, a numbered page and the previous page updates results and the URL.
- A search with no results shows the "No results" message.
- A TMDB failure shows the error page.
- Loading skeletons show while results are pending (optional, e.g. with a slow mock).

### 5.4 Movie and TV detail pages (P2)
- `/search/movie/{id}` shows the details, trailer iframe, gallery (opening the dialog works) and reviews, and the page `<title>` is correct.
- `/search/tv/{id}` shows the TV-specific fields.
- The in-page anchors (#trailer, #gallery, #reviews) scroll to the right sections.

### 5.5 Authentication and route protection (P1)
- Logged out: visiting `/my-list` redirects to sign-in, with a callback URL back to `/my-list`.
- `/signin` shows the Google and GitHub buttons. (Only check that the form posts the right provider; don't complete OAuth.)
- Logged in (seeded session): the navbar shows the avatar, and the dropdown has "Delete my account" and "Sign Out".
- Sign Out clears the session and the navbar shows "Sign In" again.

### 5.6 My list: full CRUD flow (P1)
Run with a seeded session.
- From search results or a detail page, click "Add to list", pick a status and rating, and submit. The success toast appears.
- `/my-list` shows the item with the correct rating, type and status.
- Edit changes the status and rating, a toast appears, and the list refreshes.
- Remove shows the confirmation, then the item disappears and a toast appears.
- Sorting and filtering (rating asc/desc, type, status) change the URL and the rendered items, and the active option is shown as selected.
- An empty list shows "Your list is empty."
- The item count (ListLength) matches the current filter.
- "Refresh list" resets the filters.
- When logged out, "Add to list" shows the "You need to be logged in!" toast.
- **Security (B1/B2):** a direct `PUT /api/add-to-list` or `DELETE /api/remove-from-list` with another user's id (logged out, or logged in as a different user) must not change that user's list.

### 5.7 Account deletion (P1)
- Wrong confirmation text redirects to `/?deleteAcc=fail` with the "Failed to delete account." toast, and the account still exists.
- Correct text "Delete account" deletes the user and their list, redirects to `/?deleteAcc=success` with the toast, and the session is gone.
- **Security (B3):** tampering with the hidden `id` field must not delete a different user.

---

## 6. Not worth testing

- The skeleton components in `src/Components/skeletons/*` and [Skeleton](src/Components/ui/Skeleton.tsx). They are purely visual. Optionally, a visual snapshot in Playwright.
- [Footer](src/Components/Footer.tsx), [NoImage](src/Components/ui/NoImage.tsx), [IncludeAdult](src/Components/ui/IncludeAdult.tsx) and [ListSortBtn](src/Components/ui/ListSortBtn.tsx) beyond what the tests above already cover.
- [Modal](src/Components/ui/Modal.tsx) and [sonner.tsx](src/Components/ui/sonner.tsx). They are thin wrappers around Radix and Sonner.
- [RecaptchaWrapper](src/Components/RecaptchaWrapper.tsx), `src/lib/session.ts`, and `src/db/index.ts`. They are wiring only.
- The `loading.tsx` files, `layout.tsx`, and the files in `src/types/*`.

---

## 7. Suggested order of work

1. Test infrastructure:
   - Vitest config with the `@/*` path alias and a jsdom environment for components.
   - A test DB helper that builds the schema.
   - Playwright config with a `webServer`, a mock TMDB server and a session-seeding helper.
2. Section 1 (pure logic) and section 2 (API routes and actions), including the B1–B4 security and data-integrity tests.
3. Section 3.1, 3.2, 3.5, 3.10 and 3.13 (chat, markdown safety, add-to-list, filters, pagination).
4. Sections 5.2, 5.3, 5.5, 5.6 and 5.7 (the main E2E flows).
5. Everything else.
