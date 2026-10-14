# AI chat phase 5: list-aware recommendations

Use the signed-in user's CineRadar list to fit recommendations to their taste,
and skip titles they've already watched or saved.

**Done when**

- Recommendations don't repeat titles from the user's list unless the user asks.
- "Recommend something based on my list" gives results that clearly relate to
  the user's rated titles.

## Status

| Phase | Title                                   | Depends on | Status      |
| ----- | --------------------------------------- | ---------- | ----------- |
| 1     | Per-turn list loader                    | -          | done        |
| 2     | `get_my_list` tool                      | 1          | in progress |
| 3     | Mark lookup results with `inList`       | 1          | not started |
| 4     | System prompt and thinking level        | 2, 3       | not started |
| 5     | Route test, live check and final review | 4          | not started |

Statuses: `not started`, `in progress`, `done`, `blocked (<reason>)`.

## How to work on this plan (read first)

1. **Pick one phase.** Take the first phase that isn't `done` and whose
   dependencies are all `done`. Do only that phase. Don't start the next one in
   the same session unless the user asks.
2. **Read before coding.** Read the whole "Context" and "Decisions" sections,
   plus the "Notes for later phases" of every phase that's already done. Those
   notes override this plan where they disagree, because they record what was
   actually built.
3. **Decisions are settled.** Don't re-open anything under "Decisions". If a
   phase can't be done as written, set its status to `blocked (<reason>)`, write
   down why in the progress log, and ask the user.
4. **Before you start,** set the phase's status to `in progress` in the table.
5. **When you finish:**
   - Run the checks the phase lists. They must pass. If one fails and you can't
     fix it, say so in the log; don't mark the phase `done`.
   - Fill in the phase's "Notes for later phases": names you chose, signatures,
     surprises, gotchas, and anything you changed from this plan and why. Write
     for an agent with no memory of your session. Leave out progress chatter.
   - Add a dated line to the "Progress log" at the bottom.
   - Set the phase's status to `done`.
6. **Commits:** a single title line in the repo's style (e.g.
   `feat(chat): add get_my_list tool`). No body, no `Co-Authored-By` or other
   attribution line. Commit the phase's changes once its checks pass, without
   waiting to be asked, and include this plan file's updates in that commit.
7. **Code style:** match the surrounding code. Comments are short and lowercase,
   and they say *why*, not what. Tools import `z` from `zod/v4`. Reach the list's
   server code only through `listServer()` in
   `src/modules/chat/listServer.ts`, never by a static import, because
   `scripts/check-chat-tools.ts` can't load the DB client.

## Context (how the code works today)

- **Tools** live in `src/modules/chat/tools/`.
  - Each one is a `defineTool({ name, description, status, args, run })`
    listed in `CHAT_TOOLS` in `registry.ts`.
  - `run(args, ctx)` gets `ctx: ToolContext = { signal, user }` (`tools/types.ts`).
  - `ctx.user` is `{ status: "signed_in", id } | { status: "signed_out" } |
    { status: "unavailable" }`. It comes from the session in
    `src/app/api/assistant/route.ts`, never from the model.
- **Tool results:**
  - Return a plain object, or a `DisplayOutput` when the tool shows something in
    the chat.
  - Throw a `ToolError` for the model's mistakes (the message goes to the model
    as is).
  - Other errors become `"Tool failed"`, which makes the model say it can't look
    titles up. So a signed-out user is **not** an error: see how
    `saveToList.ts` returns `saved: false` with a reason.
- **The turn loop** is `runTurn` in `src/modules/chat/llm/llmService.ts`.
  - `streamChatReply` builds the per-turn context `{ signal, user }` and
    passes it to `runToolCalls` every round.
  - There are `MAX_TOOL_ROUNDS = 4` lookup rounds. The request carrying the
    last round's results allows only `show_recommendations` and
    `save_to_list`.
  - The calls of a round run in parallel (max 10 per round, 8 s timeout each).
- **The list:**
  - `getEntries(userId)` in `src/modules/my-list/store.ts` returns
    `StoredEntry[]` in insertion order (oldest first). It's wrapped in React's
    `cache`, but don't rely on that to dedupe reads in the edge route handler.
  - `StoredEntry` is `{ movieId, type, name, image, status, rating }`.
    `rating` is 1–10, and 0 means not rated.
  - `status` is normally `"Planning to watch" | "Completed" | "Watching"`, but
    old rows can hold other strings.
  - Movie and TV ids can collide, so an entry's key is `type` + `movieId`.
- **List names are user-controlled text.** The add-to-list route doesn't cap
  their length. `src/modules/chat/llm/listChangeNote.ts` has a `clean()`
  helper that keeps them to one line, with no brackets, at most
  `MAX_TITLE_LENGTH` long. Reuse it for anything the model reads.
- **Title items:** `tools/shared.ts` → `toTitleItem` / `toTitleItems` builds
  the items the model gets. Six tools produce them: `search_titles`,
  `discover_titles`, `get_trending`, `get_recommendations` and `get_similar`
  (both via `relatedTitles.ts`), and `get_person_credits`.
  `TITLE_ITEM_FIELDS` describes those fields in the tool descriptions.
- **System prompt:** `buildSystemInstruction` in `src/modules/chat/chatConfig.ts`.
  - It's rebuilt each request with the date and the user's status.
  - Today it says "You can't read the list itself": that line must go in
    phase 4.
  - `CHAT_THINKING_LEVEL` comes from `GEMINI_THINKING_LEVEL`, with a default
    of `"minimal"`.
- **Tool schemas:**
  - They go to Gemini with every request. One rejected keyword fails **every**
    chat message.
  - `registry.test.ts` checks them against `ALLOWED_SCHEMA_KEYWORDS`.
  - `npm run check:chat-tools` checks them live. It needs `GEMINI_API_KEY`;
    if the key isn't available, ask the user to run it.
- **Tests:**
  - `*.test.ts` files are unit tests, `*.int.test.ts` files are integration
    tests (real test DB), `*.test.tsx` files are component tests.
  - Helpers: `seedUser`, `seedList`, `getMovies` and `forceFailure` in
    `tests/helpers/db.ts`; `makeMovie` in `tests/helpers/factories.ts`;
    `mockTmdb` in `tests/helpers/tmdb.ts`; `toolContext()` in
    `src/modules/chat/testing/toolContext.ts`; TMDB fixtures in
    `src/modules/chat/testing/tmdbData.ts`.
  - Look at `tools/saveToList.int.test.ts` for the patterns.
  - `assistant.route.int.test.ts` scripts Gemini's rounds and is where
    end-to-end tool flows are tested.
  - Playwright e2e tests stub `/api/assistant`, so they can't test model
    behaviour. No e2e tests are planned for this work.
- **Check commands:** `npm run test:unit`, `npm run test:integration`,
  `npm run test:components`, `npx tsc --noEmit`, `npm run typecheck:tests` and
  `npm run lint`.

## Decisions (settled)

1. **Dedup is enforced by marking lookup results.** Items from the six lookup
   tools get `inList: "<status>"` when the signed-in user has the title in
   their list. Items not in the list get no field, to keep the output small.
   The prompt tells the model to skip marked titles unless the user asks. There
   is no hard block in `show_recommendations`.
2. **The marking is done in each tool through a shared helper,** not by the
   registry rewriting every result after the fact.
3. **`get_my_list` with a signed-out user returns a normal result,** not an
   error: `{ signedIn: false, reason }`. The model asks the user in one short
   line to sign in and still gives general picks. There is no sign-in card and
   no protocol or UI change.
4. **`get_my_list` with an unavailable session or a failed DB read** throws a
   `ToolError` ("Can't read the list right now, try again later").
5. **Long lists are capped at `MAX_LIST_TITLES = 50`,** in this order:
   - rated titles, highest rating first;
   - then unrated `Completed`, then `Watching`, then `Planning to watch`, then
     any other (old) status;
   - ties go most recently added first.

   The result reports `total` and `omitted`. The `inList` marks cover the whole
   list, so dedup doesn't depend on the cap.
6. **Low ratings (1–4) count as dislikes.** They stay in the result (they sort
   after the higher ratings), and the prompt tells the model to avoid titles
   similar to them.
7. **"Based on my list" is driven by the model, not a dedicated server-side
   recommender:**
   - Round 1: `get_my_list`.
   - Round 2: `get_recommendations` and `get_similar` for the 2–3
     highest-rated titles, in parallel.
   - Round 3: `show_recommendations`.

   This fits in the round budget, and it still combines with other
   constraints, e.g. "based on my list, only 90s movies".
8. **The list is read at most once per turn,** through a memoized loader in
   `ToolContext`. The loader is reset after a round in which `save_to_list`
   succeeded. A failed read isn't memoized, so the next call retries.
9. **The thinking level will be raised from `minimal`.**
   - The prompt can rely on the model following multi-step rules, but keep them
     short and explicit.
   - The exact level (`low`, `medium` or `high`) and whether to change the code
     default or only the env var aren't decided yet. Phase 4 asks the user.
10. **`where_to_watch` is out of scope** (separate ticket). The prompt rule
    "Don't claim a title is available on a specific streaming service" stays.

---

## Phase 1: Per-turn list loader

**Goal:** add one shared, memoized way for tools to read the signed-in user's
list during a turn.

**Files:** `src/modules/chat/tools/types.ts`, a new loader module (suggested:
`src/modules/chat/tools/userList.ts`), `src/modules/chat/llm/llmService.ts`,
`src/modules/chat/testing/toolContext.ts`, and a new shared home for `clean()`
(moved out of `llm/listChangeNote.ts`).

**Steps**

1. Add the loader to `ToolContext`, e.g.
   `list(): Promise<StoredEntry[] | null>`.
   - It resolves `null` when the user isn't `signed_in`, without touching the
     DB.
   - Otherwise it calls `getEntries(user.id)` through `listServer()`.
   - It memoizes the promise for the turn. On rejection it drops the cached
     promise (like `genreCache` in `src/infra/tmdb/server.ts`) and rethrows,
     so each caller decides how to fail.
2. Also expose a way to reset the memo (e.g. the factory returns
   `{ list, invalidate }`). In `runTurn`, call the reset after a round where
   any `save_to_list` result has `isError: false`.
3. Build the loader once per turn in `streamChatReply` / `runTurn`.
   - The per-call timeout signal from the registry must **not** be tied to the
     shared read, because one call's timeout would fail the read for the
     others. The DB read doesn't take a signal today; keep it that way.
   - Optional: let `listChangeNote` use the same loader, so a turn with list
     changes doesn't read the list twice. Only do it if it stays simple.
4. Move `clean()` from `listChangeNote.ts` to a shared module (e.g.
   `src/modules/chat/llm/` or `tools/shared.ts`; mind `check:chat-tools`
   import limits) and export it. `listChangeNote` keeps using it.
5. Update `testing/toolContext.ts` so tests can pass a list, or a failing
   loader. The default stays signed out, with `list()` resolving `null`.

**Tests**

- Loader unit or int tests:
  - signed out and unavailable users never hit the DB;
  - two calls in a turn make one DB read;
  - a failed read rejects and the next call retries;
  - after a reset, the next call reads again.
- A `runTurn`-level test (in `assistant.route.int.test.ts` or the
  llmService tests) that a successful `save_to_list` round resets the loader.
  If that's awkward to observe, note how it was covered instead.
- The existing `listChangeNote` tests still pass after the move.

**Checks:** unit and integration tests, `npx tsc --noEmit`,
`npm run typecheck:tests` and lint.

**Notes for later phases:**

- **`ToolContext.list(): Promise<StoredEntry[] | null>`** (`tools/types.ts`).
  `null` when the user isn't `signed_in` (no DB read); rejects when the DB
  read fails. Each caller handles the rejection (`get_my_list` → `ToolError`,
  `listStatuses` → log and empty map). The registry spreads `ctx`, so
  `list` reaches every tool unchanged; only `signal` is replaced per call.
- **Loader:** `userList(user): UserList = { list, invalidate }` in
  `src/modules/chat/tools/userList.ts`. Both are closures (no `this`), so
  they can be destructured and passed around. It reaches the DB only via
  `listServer()`. A failed read is dropped so the next call retries; a read
  replaced by `invalidate()` that fails late doesn't drop the newer one.
- **Wiring:** `streamChatReply` builds one `userList(user)` per turn.
  `listChangeNote(list, keys)` now takes the loader instead of the user, so
  the note's read is reused by round 1's tools. `runTurn` now takes
  `ctx: ToolContext` plus an `invalidateList` callback, and calls it after
  any round where a `save_to_list` result has `isError: false` (a signed-out
  save is `isError: false` too; invalidating then is harmless).
- **`clean()`** is now exported from `tools/shared.ts` (with tests in
  `shared.test.ts`). `check:chat-tools` still loads it (`--dry-run` passes).
- **React `cache` on `getEntries`** is a pass-through in the route handler
  (Next 14.1 / React 18.2 set its dispatcher only during an RSC render), so
  a read after `invalidate()` really hits the DB.
- **Test helper:** `toolContext(signal?, user?, list?)`. `list` is
  `StoredEntry[]` (resolved as is, whatever the user) or a loader function
  (e.g. `() => Promise.reject(new Error("db down"))`). Default:
  `userList(user).list`, so signed out → `null`, and a signed-in user in an
  int test reads the real test DB.
- **Vitest gotcha:** two _concurrent_ dynamic imports of a `vi.mock`ed
  module (e.g. two `listServer()` calls in flight at once while
  `@/modules/my-list/server` is mocked) make Vitest load the real module, and
  the DB client then fails with `LibsqlError: URL_INVALID`. Warming the
  import first doesn't help. It doesn't happen in int tests (nothing mocked)
  or in production. In unit tests, make sure a second `listServer()` (e.g.
  `saveToList` next to a loader read) doesn't start while another is
  pending, or mock the loader instead (pass `list` to `toolContext`).
- **How the reset is covered:** `llm/llmService.test.ts` drives
  `streamChatReply` with scripted Gemini rounds and a mocked `runToolCalls`
  whose calls each `await ctx.list()`, then counts `getEntries` reads per
  round. Phase 5's route test can observe it end to end once tools read the
  list.

---

## Phase 2: `get_my_list` tool

**Goal:** the model can read the user's list in a small, ordered form.

**Files:** new `src/modules/chat/tools/getMyList.ts`, `tools/registry.ts`,
`registry.test.ts` (if it lists the tool names), and a new
`tools/getMyList.int.test.ts` (or `.test.ts` if the loader can be faked
without the DB).

**Steps**

1. Define `get_my_list`.
   - Name constant: `GET_MY_LIST`.
   - Status text: "Reading your list...".
   - `args: z.object({})`. Check that `toolParameters()` gives a schema
     Gemini accepts (phase 2's check run, see below).
   - Description: it returns the signed-in user's list with type, id, title,
     status and their own rating (1–10, or null when not rated); the list may
     be cut to 50 titles, best signals first; for a signed-out user it returns
     `signedIn: false`.
2. `run(_, ctx)`:
   - **`unavailable`:** throw a `ToolError`.
   - **`signed_out`:** return
     `{ signedIn: false, reason: "The user isn't signed in, so their list can't be read." }`.
   - **`signed_in`:** `await ctx.list()`. If that rejects, throw a `ToolError`
     with "Can't read the list right now, try again later" (log the error).
     Then sort per Decision 5, take the first `MAX_LIST_TITLES = 50`, and
     return:
     ```
     { total, omitted, titles: [{ type, id, title, status, rating }] }
     ```
     `id` is `movieId`, `title` is `clean(name)`, `status` is `clean(status)`,
     and `rating` is `null` when it's 0.
3. Put `get_my_list` in `CHAT_TOOLS` (after `get_title_details` and before
   `show_recommendations` reads naturally).

**Tests:** these are the ticket's required cases.

- Signed out → `{ signedIn: false, ... }`, not an error, and no DB read.
- Unavailable → `ToolError`.
- DB failure (`forceFailure` or a rejecting loader) → `ToolError`.
- Empty list → `{ total: 0, omitted: 0, titles: [] }`.
- Long list of about 120 rows, with mixed ratings and statuses, low ratings,
  and an old status string. Check that 50 come back, in the exact order of
  Decision 5 (including the newest-first tie-break), and that
  `omitted === 70`.
- A name with newlines, brackets or over-long text comes back cleaned.
- Another user's rows never appear.
- `registry.test.ts`'s schema allowlist passes for the new tool.

**Checks:** as phase 1, plus `npm run check:chat-tools` (ask the user to run
it if `GEMINI_API_KEY` isn't available). Record the result in the notes,
especially whether Gemini accepted the empty `properties` object.

**Notes for later phases:**

- **Tool:** `getMyList` in `tools/getMyList.ts`, exporting `GET_MY_LIST`
  (`"get_my_list"`) and `MAX_LIST_TITLES = 50`. It's in `CHAT_TOOLS` between
  `get_title_details` and `show_recommendations`.
- **Results:** signed in →
  `{ total, omitted, titles: [{ type, id, title, status, rating }] }`, where
  `rating` is `null` when it's 0. Signed out →
  `{ signedIn: false, reason: "The user isn't signed in, so their list can't be read." }`,
  without calling `ctx.list()`. Unavailable, or `ctx.list()` rejects →
  `ToolError("Can't read the list right now, try again later")`. A rejection
  is logged as `console.error("Can't read the list:", error)`. A `null` from
  `list()` while signed in can't really happen; it's treated as an empty
  list.
- **Order:** sorted on the raw (uncleaned) status. The entries are reversed and
  then given a stable `sort`, which makes ties newest first. Unrated titles
  rank `Completed`, `Watching`, `Planning to watch`, then any other status.
- **Schema:** `toolParameters` gives `{ type: "object", properties: {} }`
  (snapshot in `registry.test.ts`), and the allowlist passes.
  `check:chat-tools --dry-run` passes. The live run is still waiting on the
  user, because `GEMINI_API_KEY` isn't set locally.
- **Brought forward from phase 4:** `chatConfig.test.ts` ("names every tool")
  requires the prompt to name every tool, and the old line contradicted the
  new tool. So the list-question bullet now ends "answer it with
  get_my_list." instead of "answer it from this conversation, without
  calling a tool. You can't read the list itself." A new test checks this and
  that the old line is gone. Phase 4 still has to add everything else, such as
  the "Pick the tools" entry.
- **Tests:** `tools/getMyList.int.test.ts`. A failed read is tested with a
  rejecting loader, because `forceFailure` only covers writes. The test file's
  long-list case uses 120 rows with ratings 9 and 2, the three statuses and
  `"Dropped"`.

---

## Phase 3: Mark lookup results with `inList`

**Goal:** every title item a lookup tool returns says whether the user already
has it, so the model can skip it without calling `get_my_list`.

**Files:** `tools/shared.ts`, and the six lookup tools: `searchTitles.ts`,
`discoverTitles.ts`, `getTrending.ts`, `relatedTitles.ts` (covers
`get_recommendations` and `get_similar`) and `getPersonCredits.ts`. Plus their
tests.

**Steps**

1. In `shared.ts`, add a helper that turns `ctx` into a lookup of listed
   statuses, e.g. `listStatuses(ctx): Promise<Map<string, string>>` keyed by
   `${type}-${id}`.
   - It **never throws**: if `ctx.list()` rejects, log the error and return an
     empty map, so lookups keep working without the marks.
   - Signed-out users get an empty map.
2. Add the mark to the items: `inList: clean(status)` only when the title is
   listed. Either take the map as an optional extra argument of `toTitleItem`
   / `toTitleItems`, or add a small `markListed(items, statuses)` step. Choose
   whichever keeps the six call sites simplest.
3. In each tool, fetch the statuses **in parallel** with the TMDB requests
   (e.g. in the existing `Promise.all` next to `getGenres`). They must not add
   a sequential DB round trip to every lookup.
4. Update `TITLE_ITEM_FIELDS` so the descriptions mention `inList` ("and
   inList with its status when the title is already in the user's list").
   Check whether `getPersonCredits` builds its own description, and update it
   too.

**Tests**

- For each tool, or at least the shared helper plus one tool per call-site
  shape (`toTitleItems`, `toTitleItem` with `.map`, `getPersonCredits`):
  - a listed title is marked with its status;
  - an unlisted one has no `inList` key;
  - a signed-out context gets no marks;
  - a rejecting loader gets no marks and the tool still returns its results.
- Movie and TV with the same id: only the matching type is marked.
- The existing tool tests still pass. Their expected objects shouldn't change
  for signed-out contexts.

**Checks:** as phase 1. If any tool description changed, also run
`npm run check:chat-tools`.

**Notes for later phases:** _(fill in when done)_

---

## Phase 4: System prompt and thinking level

**Goal:** the model uses the list. It skips listed titles by default, and
"based on my list" gives recommendations seeded from the user's top-rated
titles.

**Files:** `src/modules/chat/chatConfig.ts` and `chatConfig.test.ts`.

**Steps**

1. **Thinking level:** ask the user which level (`low`, `medium` or `high`)
   and whether to change `DEFAULT_THINKING_LEVEL` in code or only
   `GEMINI_THINKING_LEVEL` in the env. Record the answer under Decision 9.
   Make the change if it's a code change.
2. **Prompt changes** in `buildSystemInstruction` (keep the existing tone:
   short imperative bullets):
   - Remove "You can't read the list itself." Questions about the list
     ("is it in my list?", "what have I rated highest?") are answered with
     `get_my_list`, not from memory.
   - **Skip listed titles:** titles with `inList` are already in the user's
     list. Don't recommend them unless the user asks for them (e.g. a rewatch,
     "something from my watchlist", "which of my saved ones…").
   - **"Based on my list"** (also "for me", "my taste", "what I like"):
     - Call `get_my_list` first.
     - Then call `get_recommendations` and `get_similar` in parallel for the
       2–3 highest-rated titles. Prefer `Completed` ones. If nothing is rated,
       use `Completed` and `Watching` titles.
     - Each reason names the list title it relates to (e.g. "Like Fury, which
       you rated highly…").
     - The user's own ratings may be mentioned in reasons. The "don't write
       ratings" rule is about TMDB ratings: reword it so the two don't
       conflict.
   - **Dislikes:** avoid titles similar to ones the user rated 1–4.
   - **Empty list or no usable titles:** say so in one short line, give
     general picks (e.g. popular or top-rated), and suggest rating titles.
   - **Signed out:** if `get_my_list` returns `signedIn: false`, ask the user
     in one short line to sign in to use their list, and still give general
     picks.
   - Mention the tool in the "Pick the tools that fit the request" list.
3. Keep the changes small. Every bullet the model reads costs tokens on every
   request.

**Tests:** `chatConfig.test.ts` asserts each new rule's key phrase, in the
style of the existing "tool rules" tests, and that "You can't read the list
itself" is gone.

**Checks:** as phase 1, plus `npm run check:chat-tools` (the prompt and
possibly the thinking level changed).

**Notes for later phases:** _(fill in when done)_

---

## Phase 5: Route test, live check and final review

**Goal:** prove the whole flow through the route, and check the "Done when"
goals against the real model.

**Steps**

1. In `assistant.route.int.test.ts`, script a turn with a signed-in user and a
   seeded list:
   - Round 1: `get_my_list`.
   - Round 2: `get_recommendations` for the top-rated title, whose TMDB mock
     returns one listed and one unlisted title.
   - Round 3: `show_recommendations`.

   Assert that the function results Gemini receives contain the ordered list
   and the `inList` mark, and that the cards are streamed.
2. Also script a signed-out `get_my_list` turn: the result isn't an error,
   and no `sign_in_required` event is sent.
3. **Live manual check** at the raised thinking level, with
   `AI_CHAT_ENABLED=true` and a seeded test account. Ask the user to do this
   if you can't run the app with real keys. Try these:
   - "recommend something based on my list" with a list of about 10 rated
     titles: the reasons should name the list's titles, and no listed title
     should be recommended;
   - "recommend sci-fi movies" when the list holds popular sci-fi titles: the
     listed ones should be skipped;
   - "recommend a rewatch from my list": listed titles are allowed;
   - an empty list, and signed out.

   Record what happened in the notes, including any prompt tweaks it led to.
4. Review the whole diff of phases 1–5 for leftovers: dead code, the old
   prompt line, unused exports and stale comments.

**Checks:** all test projects, `npx tsc --noEmit`,
`npm run typecheck:tests`, lint and `npm run check:chat-tools`.

**Notes:** _(fill in when done)_

---

## Out of scope

- `where_to_watch` (TMDB `/{type}/{id}/watch/providers`). It needs a country
  source, JustWatch attribution and a change to the streaming-availability
  prompt rule. It goes in a separate ticket.
- A sign-in card for `get_my_list`.
- A server-side "recommend from list" tool.

## Progress log

_(one dated line per session: date, phase, what was done or what blocked it)_

- 2026-10-14, phase 1: done. Added `userList` loader and `ToolContext.list`, wired into `streamChatReply`/`runTurn` (reset after a successful save), `listChangeNote` reads through it, moved `clean()` to `tools/shared.ts`. Unit, integration, tsc, typecheck:tests and lint pass.
- 2026-10-14, phase 2: added the `get_my_list` tool, int tests and the prompt line naming it. Unit, integration, tsc, typecheck:tests, lint and `check:chat-tools --dry-run` pass. Waiting for the user's live `check:chat-tools` run before marking it done.
