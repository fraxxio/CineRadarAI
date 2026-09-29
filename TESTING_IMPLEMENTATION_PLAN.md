# CineRadar AI: Test Implementation Plan

This is the technical companion to [TESTING_PLAN.md](TESTING_PLAN.md). That file says **what** to test. This file says **how**: the Vitest and Playwright infrastructure, the helpers, and the technique for each test case.

Section 6 uses the same numbering as TESTING_PLAN.md (6.1.1 ↔ 1.1, 6.2.3 ↔ 2.3, and so on), so every case can be traced back.

---

## Status

| Phase (section 7) | State |
|---|---|
| 1. Infrastructure | **Done** (2026-09-29, branch `add-unit-and-integration-tests`) |
| 2. 6.1 + 6.2 | **Done** (2026-09-29, same branch) |
| 3. Core component tests | **Done** (2026-09-29, same branch) |
| 4. Core E2E specs + variant specs | **Done** (2026-09-29, same branch) |
| 5. Everything else | Not started |
| 6. Bug fixes | Not started |

**Phase 1 checklist**

- [x] Dependencies (section 1). See "Deviations" for version pins.
- [x] `vitest.config.mts`, setup files, `drizzle.test.config.ts` (3.1, 3.2)
- [x] Helpers: `db`, `factories`, `next`, `requests`, `stream`, `tmdb`, plus the new `migrations` (3.3)
- [x] Playwright: `env.ts`, `playwright.config.ts`, `global-setup.ts`, `fixtures.ts`, `helpers/db.ts`, `helpers/chat.ts` (4.2–4.7)
- [x] Mock TMDB server and the fixtures in `tests/fixtures/tmdb/` + `pixel.png` (4.4)
- [x] Repo changes (4.8): `distDir`, `tsconfig.json`, `.gitignore`, the 4 `aria-label`s, the skeleton `data-testid`, and `getTitle` moved to `src/lib/searchTitle.ts`
- [x] Smoke tests: `tests/unit/smoke.test.ts`, `tests/integration/smoke.test.ts`, `tests/components/smoke.test.tsx`, `tests/e2e/smoke.spec.ts`
- [x] Scripts and CI (5): `.github/workflows/tests.yml`

**Phase 2 checklist**

- [x] 6.1 unit: `tests/unit/lib/{utils,validation,myList,loaderWords,chatConfig,recaptcha,searchTitle}.test.ts`, `tests/unit/auth.test.ts`, `tests/unit/app/search-metadata.test.ts`
- [x] 6.2 integration: `tests/integration/api/{add-to-list,remove-from-list,assistant,recaptcha}.test.ts`, `tests/integration/actions.test.ts`, `tests/integration/lib/myList.test.ts`
- [x] Known bugs under `test.fails`: B1 ×2, B2 ×2, B3, B4 ×2, B7, B8, B11 (10 in total). Each was checked by temporarily flipping it to `test`: every one fails on the bug's own assertion (e.g. `expected 200 to be 401`), not on a setup error.
- [x] `test.todo` × 3 for add-to-list payload validation.

**Phase 3 checklist**

- [x] 6.3.1 `tests/components/ChatAssistant.test.tsx`
- [x] 6.3.2 `tests/components/AssistantMessage.test.tsx`
- [x] 6.3.5 `tests/components/AddToListBtn.test.tsx`
- [x] 6.3.10 `tests/components/FiltersForm.test.tsx`
- [x] 6.3.13 `tests/components/Pages.test.tsx`, including B5 ×2 under `test.fails`. Both were flipped to `test` and fail on the bug's own assertion (`Received element is not disabled`, `expected <button> to be null`).
- [x] New helper `tests/helpers/deferred.ts` (D17).

**Phase 4 checklist**

- [x] 6.5.2 `tests/e2e/chat.spec.ts`
- [x] 6.5.3 `tests/e2e/search.spec.ts`, including B6 under `test.fail`
- [x] 6.5.5 `tests/e2e/auth.spec.ts`, including B10 as `test.fixme`
- [x] 6.5.6 `tests/e2e/my-list.spec.ts`
- [x] 6.5.6b `tests/e2e/security.spec.ts`: B1 ×2, B2 ×2 under `test.fail`
- [x] 6.5.7 `tests/e2e/account-deletion.spec.ts`, including B3 under `test.fail`
- [x] 6.5.2b `tests/e2e/variants/chat-disabled.spec.ts` (B9 under `test.fail`) and `tests/e2e/variants/recaptcha.spec.ts`
- [x] `--pass-with-no-tests` removed from `test:e2e:variants` (D8).
- [x] All 7 E2E `test.fail` cases were flipped to `test`. Each fails on the bug's own assertion: the victim's list changed (B1/B2), the victim was deleted (B3), the mock received `query=Tom|` (B6), and the input got `"hello"` (B9).

**Verified locally (phase 4)**

- `npm run test:e2e`: 34 passed + 1 skipped (B10 fixme), with `next dev`. Stable over 2 runs and `--repeat-each=3` (102 passed).
- `CI=1 E2E_DATABASE_URL=… npm run test:e2e` (34 passed + 1 skipped) and `npm run test:e2e:variants` (2 + 2 passed) pass with `next build` + `next start`.
- Mutation check: 9 hand-made mutants in the app, each killed by the matching spec. They removed `router.refresh()` in EditListBtn, redirected DeleteUser to `fail`, dropped `previousInteractionId`, dropped the middleware's `callbackUrl`, flipped the rating sort, removed the input's `disabled` while loading, dropped `&page=` from the TMDB URL, replaced `signOut` with a bare redirect, and ignored `success: false` from `/api/recaptcha`.
- `npm run typecheck:tests`, `npm run lint` and `npx prettier --check tests` are clean.

**Verified locally (phase 3)**

- `npm run test:run` / `npm run test:coverage` pass: 23 files, 222 passed + 12 expected fail + 3 todo. Stable over 3 runs. No React `act(...)` warnings.
- Coverage of the phase-3 targets: 100% lines for `ChatAssistant`, `AssistantMessage`, `AddToListBtn`, `FiltersForm` and `Pages` (and for `PageBtn`, `SubmitBtn`, `ChatSubmitBtn`, `ThinkingLoader`, which they render). Branches: `ChatAssistant` 97.6%, `Pages` 100%, `AssistantMessage` 88.9%, `FiltersForm` and `AddToListBtn` 75% (the non-`btn` submitter check and the `fullSize` class variants).
- Mutation check: 31 hand-made mutants across the five components (chunk reassembly, blank lines, message cap, `previousInteractionId`, reset after failure, missing `done`, error-event handling, reCAPTCHA timing/action/result, link targets, form reset, request body, pagination limits, filter propagation...). All are killed except the removal of the `!response.body` guard. That one is an equivalent mutant: `null.getReader()` throws, so the turn fails the same way.
- `npm run typecheck:tests`, `npm run lint` and `npx prettier --check tests` are clean.

**Verified locally (phases 1–2)**

- `npm run test:run` / `npm run test:coverage` pass: 18 files, 165 passed + 10 expected fail + 3 todo. Stable over repeated runs.
- Coverage of the phase-2 targets: `src/lib` 96–98% (only `session.ts` is uncovered, because it's mocked globally), `src/auth.ts` and all four API routes at 100% lines, `actions.ts` 94% (`SignOut` is left for E2E).
- `npm run typecheck:tests`, `tsc --noEmit` and `npm run lint` are clean.
- `npm run test:e2e` passes (2 tests), both with `next dev` and with `CI=1` (`next build` + `next start`, DB given through `E2E_DATABASE_URL`).
- `npm run test:e2e:variants` passes with `CI=1`. It has no specs yet (see "Deviations").
- Running the E2E servers leaves the git tree clean. `next dev` does not rewrite `tsconfig.json`.

The smoke tests check the infrastructure itself, not app features. They cover the `react.cache` shim, test env instead of `.env`, the temp-file DB surviving a transaction (F4), reset between tests, `forceFailure`, the `next/image` and server-action mocks, and the DB-session login. Keep them after phase 2.

**Deviations from the original plan** (the sections below are already updated to match)

| # | Change | Why |
|---|--------|-----|
| D1 | `vitest@^4` and `@vitest/coverage-v8@^4` are pinned explicitly. | Vitest 5 is now `latest`, and its peer range for `@types/node` excludes the project's `^20`. |
| D2 | `typescript` goes from 5.4.2 to `^5.9` (5.9.3). | TS 5.4 can't parse the type definitions of `@vitejs/plugin-react` 6 (`export { x as "module.exports" }` needs TS ≥ 5.6). `skipLibCheck` doesn't help because it's a parse error. `next build` passes with 5.9. |
| D3 | `tests/tsconfig.json` sets `"target": "ES2022"`. | The root config has no `target`, and `stream.ts` iterates `entries()`. |
| D4 | The root `tsconfig.json` also excludes `playwright.config.ts` and `drizzle.test.config.ts`. `tests/tsconfig.json` includes them, along with `vitest.config.mts`. | Keeps `next build` type-checking independent of the test tooling. |
| D5 | New `tests/helpers/migrations.ts` (`MIGRATIONS_FOLDER`, `generateTestMigrations()`), used by both global setups. | One copy of the generate command. |
| D6 | E2E global setup **drops all tables** before migrating, instead of deleting rows. | Migrations are regenerated with a new file name and hash on every run. A reused DB therefore replayed `CREATE TABLE` and failed with `table lists already exists`. |
| D7 | Local sqld container is started with `--name cineradar-e2e-db`. CI provides the DB as a **service container** through `E2E_DATABASE_URL`. | Playwright kills only the `docker run` client, so the container outlives the run. In CI (`reuseExistingServer: false`), the second Playwright run would find port 8089 in use and fail. |
| D8 | `test:e2e:variants` passed `--pass-with-no-tests` until phase 4. | The variant specs arrived in phase 4. Without the flag, Playwright exits 1 ("No tests found"). **Removed in phase 4.** |
| D9 | sqld is pinned to `ghcr.io/tursodatabase/libsql-server:v0.24.33` (`LIBSQL_IMAGE` in `tests/e2e/env.ts`, and in the CI workflow). | Reproducible runs. Keep both places in sync. |
| D10 | Optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` → `launchOptions.executablePath`. | The downloaded Chromium can't find system libraries on NixOS. Locally, run `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=$(which chromium) npm run test:e2e`. CI leaves it unset. |
| D11 | Small additions: `forbidOnly` in CI, `outputDir: test-results/<variant>`, `TMDB_URL` in `env.ts`, `tmdbFixture()` in `helpers/tmdb.ts`. `mockTmdb` also accepts `Request` inputs and clones `Response` routes, so a route can be hit twice. | Convenience. No design change. |
| D12 | New `tests/helpers/auth.ts` with a shared `asUser()`, instead of a copy in each file (6.2). It only works in files that `vi.mock("@/auth", ...)`. | Three files need it. It also hides the cast that `auth`'s overloaded type needs. |
| D13 | `tests/helpers/db.ts` gains `seedFullUser()` (planned in 6.2.5) and `userRows(id)`, which returns `{ users, accounts, sessions, lists }` row counts. | One assertion covers all four tables for DeleteUser. |
| D14 | The non-bug add/remove tests log in as the list owner (`asUser(user)` in `beforeEach`), even though the routes ignore the session today. | Once B1/B2 are fixed and the routes read `session.user.id`, these tests keep passing unchanged. |
| D15 | `assistant.test.ts` calls `create.mockReset()` in `beforeEach`. | `clearMocks`/`restoreMocks` don't reset the implementation of a `vi.hoisted` `vi.fn()` in Vitest 4, so a `mockResolvedValue` would leak into the next test. |
| D16 | Small additions beyond section 6: reCAPTCHA 404 also when only the site key is missing, the `null`/missing interaction-id cases also assert `previous_interaction_id: undefined`, the NDJSON framing test uses a delta containing quotes and `\n`, and the `getTitle` matrix lives in `tests/unit/lib/searchTitle.test.ts`. | Cheap extra coverage. |
| D17 | New `tests/helpers/deferred.ts` (`deferred<T>()` → `{ promise, resolve, reject }`). | In-flight assertions (AddToListBtn now, EditListBtn/DeleteListBtn in phase 5). `Promise.withResolvers` isn't in the `ES2022` lib. |
| D18 | `ChatAssistant.test.tsx` calls `vi.mocked(useGoogleReCaptcha).mockReset()` and `vi.useRealTimers()` in `afterEach`. | Same reason as D15: a `mockReturnValue` on the setup file's `vi.fn()` would leak into later tests of the file. In Vitest 4, `mockReset` goes back to the original `executeRecaptcha: undefined` implementation. |
| D19 | The ChatAssistant "error event" case pushes `start` + `error` into a `controlledStream()` that is **never closed**. | With a closed stream, the turn fails anyway ("stream ended without `done`"), so ignoring the `error` event went unnoticed. The mutation check found it. |
| D20 | Small additions beyond 6.3: ChatAssistant covers a malformed NDJSON line, a reCAPTCHA verify request that returns 500, the prompt being kept after a failed verification or when `executeRecaptcha` isn't ready, and the submit button enabling once text is typed. AddToListBtn covers an empty rating, and "close + reset" runs for all three outcomes. Pages covers `page={undefined}` and asserts that 800 isn't rendered. | Cheap extra coverage. |
| D21 | The "all filters" and "no empty selects" FiltersForm cases compare parsed search params, not the raw URL string. The two button cases still compare the exact URL. | The parameter order is `buildSearchURL`'s business (covered in 6.1.1). |
| D22 | B3 (account deletion) rewrites the server-action POST with `page.route` (the attacker's id → the victim's id) instead of editing the hidden `id` input. | React writes the controlled `value={id}` back to the hidden input during the submit, so the edited DOM value never reaches the server. With the plan's approach, the attacker deleted their **own** account and the `test.fail` passed unexpectedly. Rewriting the request is also closer to a real attack. |
| D23 | Toast assertions on `/?deleteAcc=…` use `.first()`. | `DeleteResult` calls `toast()` from render (inside a `setTimeout`), so StrictMode in `next dev` shows the toast **twice**. Any extra re-render would do the same in production. Candidate bug **B12**: move the toast into a `useEffect` (with a ref guard). |
| D24 | The trending case expects **20** cards, not 6. | The mock returns 20 results per page (`PAGE_SIZE`). "6" in 6.5.3 was a typo. |
| D25 | The B6 and skeleton cases add a random suffix to the query (`unique()` in `search.spec.ts`). | The request log is shared by parallel workers, and a unique query can't be served from Next's Data Cache (F12). In practice these dynamic pages weren't cached, but the suffix costs nothing. |
| D26 | The 6.5.6 "Count" case is folded into "Sort / filter": `expectItems()` checks the item names and `Length: N` together after every step. The walk also goes to "Movies" (after TV + Watching) to reach an empty filtered list. `Sort / filter` and `Refresh` share the same 4 seeded items. | One place for the order and count assertions. |
| D27 | Small additions beyond 6.5: chat asserts the exact request bodies and that the input is re-enabled after an error, search checks that the language select keeps its value after a reload and that TV results have no movie links, my-list checks the DB after add/edit/remove, and the reCAPTCHA failure case asserts exactly one verify request. B9 checks the typed value first and `[inert]` second, so the user-visible failure is the one reported. | Cheap extra coverage. |
| D28 | The reCAPTCHA stub sets `window.__grecaptchaReady` inside `ready()`, and the spec waits for it before typing. | Before the provider has its grecaptcha instance, `executeRecaptcha` is `undefined` and a submit is silently ignored. |

**Notes for the next phases**

- The mock TMDB server returns 20 results per page. The 3rd review in `reviews.json` carries the XSS payloads, which set `window.__xss`.
- `next dev` logs React's "non-boolean attribute `inert`" warning on the home page. That warning is B9.
- `next lint` only lints `src/`, so `tests/` isn't linted. Run `npx prettier --write tests` instead.
- A `test.fails` passes on **any** failure, including a typo or a broken mock. After writing one, check why it fails by flipping every `test.fails(` to `test(` for a moment. In zsh/bash: `grep -rl "test.fails" tests | while read f; do cp "$f" "$f.bak"; sed -i 's/test\.fails(/test(/' "$f"; done; npx vitest run; for b in $(find tests -name "*.bak"); do mv "$b" "${b%.bak}"; done`.
- Vitest 4: `vi.spyOn(globalThis, "fetch")` is typed as `MockInstance<typeof fetch>` (see `recaptcha.test.ts`).
- jsdom 30 + user-event set `SubmitEvent.submitter` correctly, so FiltersForm's movie/TV buttons work in jsdom (the open question in 6.3.10).
- Radix `Dialog` works in jsdom. While it's open, everything outside it is `aria-hidden`, so query inside it with `within(screen.getByRole("dialog"))`. The trigger's name ("Add to list") is the same as the submit button's.
- Mocked `vi.fn()`s from the setup files (`useGoogleReCaptcha`, `useFormStatus`) keep a `mockReturnValue` until `mockReset()`. Reset them in `afterEach` in any file that overrides them (D18). `toast.*` and the router mocks only record calls, so `clearMocks` is enough for those.
- To check that a new test can actually fail, break the component on purpose (a `perl -0pi -e 's/.../.../'` on a copy), run the one test file, and restore the copy. This is how D19 was found.
- For phase 5: `ThinkingLoader`, `ChatSubmitBtn`, `SubmitBtn` and `PageBtn` already have 100% line coverage through the phase-3 tests. Their own 6.3.3/6.3.4/6.3.12 cases are still worth writing, but they're low value.
- E2E iteration: start the TMDB mock and `next dev -p 3100` yourself with the `appEnv` values from `playwright.config.ts` (and `NEXT_DIST_DIR=.next-e2e-default`). `reuseExistingServer` then picks them up, and a spec runs in a few seconds. Don't `pkill -f tmdb-server.mjs` from a shell whose own command line contains that string: it kills the shell.
- E2E locators: the navbar is a `<ul>`, so scope `listitem` queries to `getByRole("main")`. There are two `AuthBtn`s (desktop + mobile), so scope to `nav#top`. Selects without labels (language, year) are located by `select[name=…]`. A ListCard row is `main div.border-b` filtered by its item link.
- Expected server-log noise during E2E: every visit to `/search/movie/550` logs four TMDB `404`s ("Error fetching movie details/trailer/images/reviews"). The cause is the XSS review in `reviews.json`. The sanitiser strips `onerror` from `<img src="x" onerror=…>` but keeps `src="x"`, so the browser requests `/search/movie/x`, which renders a movie page for id `x`, and the mock rejects the non-numeric id. It's harmless. If it bothers 6.5.4, point that `src` at a stubbed host (`https://image.tmdb.org/x.png`). The `500` for `__error__` is expected too.
- The E2E `test.fail` check works like the Vitest one: `sed -i 's/^test\.fail(/test(/'` on a copy, run with `-g "B[0-9]"`, restore. In zsh, put multiple files in an array (`FILES=(a b)`), because unquoted `$FILES` isn't word-split.

---

## 0. Facts that shape the setup

Each item below was checked against the code and the installed packages (Next 14.1.3, React 18.2.0, next-auth 5.0.0-beta.16, @libsql/client 0.6.0, drizzle-orm 0.30.7, drizzle-kit 0.20.14, @google/genai 2.24.0, Node 24). Most of the design decisions follow from them.

| # | Fact | Consequence |
|---|------|-------------|
| F1 | The middleware (`auth` on every page) and the home page (`runtime = "edge"`) run on the **edge runtime**. There, `@libsql/client` resolves to `lib-esm/web.js`, which accepts only `http(s)`/`ws(s)` URLs and throws `URL_SCHEME_NOT_SUPPORTED` for `file:`. | E2E cannot use a `file:` SQLite DB. It needs a local **libsql HTTP server** (`sqld` in Docker, or `turso dev`). |
| F2 | Vitest resolves stable `react@18.2.0`, which has **no `cache`** export and whose `react-dom` has **no `useFormStatus`**. Next uses its bundled React canary at runtime, which has both. | `src/lib/myList.ts` and `src/lib/session.ts` throw `cache is not a function` on import in Vitest. `DeleteModalBtn` crashes. A shared setup file must shim both. |
| F3 | `src/db/index.ts` creates the libsql client **at import time** from `process.env.DATABASE_URL`. | Tests set `DATABASE_URL` before `@/db` is imported. No Drizzle mocking is needed for integration tests. |
| F4 | With `@libsql/client`, `url: ":memory:"` **loses the database after a transaction**, because the client opens a fresh connection afterwards. Verified: `no such table` right after `tx.commit()`. `DeleteUser` uses `db.transaction`. | Integration tests use a **temp file DB per Vitest worker**, never `:memory:`. |
| F5 | `drizzle/` only has migration `0001`. Running `drizzle-kit generate:sqlite` from the schema into an empty folder produces one complete migration with all 5 tables (verified). | Test migrations are **generated from `src/db/schema/*`** into a git-ignored folder on every test run, so they can't drift from the schema. |
| F6 | next-auth v5 is ESM and imports `next/server` without an extension. Node's ESM loader rejects that. | Add `server.deps.inline: ["next-auth"]` to the Vitest config so Vite resolves it. Otherwise `src/auth.ts` can't be imported in tests. |
| F7 | The edge build of `@google/genai` ignores `GOOGLE_GEMINI_BASE_URL`, and the route doesn't pass `httpOptions`. | Gemini can't be mocked behind a running Next server. The real `/api/assistant` route is covered in Vitest with the SDK mocked. E2E stubs `/api/assistant` at the browser level with `page.route`. |
| F8 | `NEXT_PUBLIC_*` values are **inlined at build/compile time**, including into server code (`isRecaptchaEnabled`). | The reCAPTCHA-enabled E2E path needs its own server process. It can't be toggled at runtime. |
| F9 | `.env` sets `NEXTAUTH_URL=http://localhost:3000/`, and next-auth rewrites the request origin to that value. | Every E2E server must set `AUTH_URL`/`NEXTAUTH_URL` to its own port. Otherwise auth redirects go to :3000. |
| F10 | Next's env loader never overrides a variable that already exists in `process.env`, **including `""`** (checked in `@next/env`). | Playwright's `webServer.env` can reliably override or blank out anything in the developer's `.env`. |
| F11 | `tsconfig.json` has `"jsx": "preserve"`. | Vitest needs `@vitejs/plugin-react` to compile JSX. |
| F12 | Next 14 may cache server-side `fetch` calls (the Data Cache). | The TMDB mock picks its scenario from the **request input** (query string / id), never from mutable server state. That way a cached response can't hide a scenario. |
| F13 | Next only allows specific exports from `page.tsx`. Exporting `getTitle` from `src/app/search/page.tsx` fails `next build`. | To unit-test `getTitle` (B7), move it to `src/lib/searchTitle.ts`. |

### New issues found while planning

Add these to the bug table in TESTING_PLAN.md:

| # | Where | Problem |
|---|-------|---------|
| B9 | [src/app/page.tsx](src/app/page.tsx) | `<div inert>` is dropped by React 18. Verified: `renderToStaticMarkup(<div inert>)` → `<div>`, and Next's bundled react-dom has no `inert` support. With the chat disabled, `pointer-events-none` blocks the mouse but the input can still be reached and typed into with the keyboard. Fix: `inert=""` (a string), or `disabled` on the input. |
| B10 | [src/app/signin/page.tsx](src/app/signin/page.tsx) | `signIn(provider, { redirectTo: "/" })` ignores the `callbackUrl` that the middleware adds. After logging in from `/my-list`, the user lands on `/`. This is minor. |
| B11 | `/api/assistant`, `/api/recaptcha` | A malformed JSON body makes `request.json()` throw, which returns a 500 instead of a 400. This is minor. |
| B12 | [src/Components/ui/DeleteResult.tsx](src/Components/ui/DeleteResult.tsx) | Found in phase 4. The toast is fired from render (`setTimeout` in the component body), so every render shows it again. In `next dev` (StrictMode) the "Account deleted" / "Failed to delete" toast appears twice. Fix: fire it from a `useEffect`, guarded by a ref. This is minor. |

---

## 1. Dependencies

```bash
npm i -D vitest@^4 @vitest/coverage-v8@^4 @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom \
  @playwright/test typescript@^5.9
npx playwright install chromium
```

Installed: vitest 4.1.11, @vitejs/plugin-react 6.1.1 (vite 8.3.1), jsdom 30.1.1 (needs Node ≥ 22.22.2 / 24.15), @testing-library/react 16.3.3, @testing-library/jest-dom 7.0.1, @playwright/test 1.63.0, typescript 5.9.3. For the pins, see D1 and D2 in "Status".

- Vitest 4.x uses the `test.projects` config (the old `workspace` file is gone).
- Vitest 4 note: a `vi.fn()` that is called with `new` must use a `function`/class implementation, not an arrow function. This matters for the `GoogleGenAI` mock.
- jsdom is already installed transitively (v24 via isomorphic-dompurify). Pin it explicitly anyway.
- Docker is needed for the E2E DB (it's on this machine). Alternative: set `E2E_DATABASE_URL` to a `turso dev` server.

---

## 2. Repository layout

```
vitest.config.mts
playwright.config.ts
drizzle.test.config.ts
tests/
  tsconfig.json                    # extends root; adds vitest/playwright types; root tsconfig excludes tests/
  .generated/                      # git-ignored: generated migrations
  fixtures/
    tmdb/                          # hand-written TMDB JSON, shared by Vitest and the mock server
      languages.json  movie-550.json  tv-1399.json  videos.json  images.json  reviews.json
    pixel.png
  setup/
    shared.ts                      # all Vitest projects: React canary shims, @/lib/session mock
    integration.ts                 # DB env per worker, next/cache mock, migrate + reset hooks
    integration.global.ts          # generate migrations, delete stale DB files
    components.tsx                 # jest-dom, cleanup, next/navigation, next/image, sonner, actions, recaptcha mocks
  helpers/
    db.ts  next.ts  requests.ts  stream.ts  tmdb.ts  factories.ts
    migrations.ts                  # MIGRATIONS_FOLDER + generateTestMigrations() (D5)
  unit/                            # mirrors src/: unit/lib/utils.test.ts, unit/auth.test.ts, ...
    smoke.test.ts                  # phase 1
  integration/                     # integration/api/add-to-list.test.ts, integration/actions.test.ts, ...
    smoke.test.ts                  # phase 1
  components/                      # client components (*.test.tsx)
    smoke.test.tsx                 # phase 1
  server-components/               # async server components rendered with mocked fetch
  e2e/
    env.ts  global-setup.ts  fixtures.ts
    helpers/chat.ts  helpers/db.ts
    mocks/tmdb-server.mjs
    smoke.spec.ts                  # phase 1
    navigation.spec.ts  chat.spec.ts  search.spec.ts  details.spec.ts
    auth.spec.ts  my-list.spec.ts  account-deletion.spec.ts  security.spec.ts
    variants/chat-disabled.spec.ts  variants/recaptcha.spec.ts
```

Tests live outside `src/` so that `next build` type-checking and ESLint don't depend on the test tooling. The root `tsconfig.json` adds `"tests"` to `exclude`. `tests/tsconfig.json` extends the root and includes `["../src/**/*", "**/*", "../next-env.d.ts"]`, so the ambient types in `src/types/*` (`ChatStreamEvent`, `Tmessage`, `FetchedData`) are visible. Add a `typecheck:tests` script (section 5).

---

## 3. Vitest infrastructure

### 3.1 `vitest.config.mts`

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()], // F11: tsconfig has jsx: "preserve"
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    setupFiles: ["./tests/setup/shared.ts"],
    server: { deps: { inline: ["next-auth"] } }, // F6
    // Vitest does not load .env, so real secrets never reach tests
    env: {
      TMDB_BASE_URL: "https://tmdb.test/3",
      TMDB_ACCESS_TOKEN: "test-tmdb-token",
      AUTH_SECRET: "test-auth-secret",
      GEMINI_API_KEY: "test-gemini-key",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/types/**", "src/Components/skeletons/**", "src/**/loading.tsx", "src/app/layout.tsx"],
    },
    projects: [
      {
        extends: true,
        test: { name: "unit", environment: "node", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["./tests/setup/integration.ts"],
          globalSetup: ["./tests/setup/integration.global.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["tests/components/**/*.test.tsx", "tests/server-components/**/*.test.tsx"],
          setupFiles: ["./tests/setup/components.tsx"],
        },
      },
    ],
  },
});
```

### 3.2 Setup files

**`tests/setup/shared.ts`** (every project, F2):

```ts
import { vi } from "vitest";

// Vitest resolves stable React 18.2; Next runs the App Router on its bundled canary,
// which has react.cache and react-dom.useFormStatus. Shim the gap.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react") & { cache?: unknown }>();
  return { ...actual, cache: actual.cache ?? (<T>(fn: T) => fn) };
});

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return {
    ...actual,
    useFormStatus: vi.fn(() => ({ pending: false, data: null, method: null, action: null })),
  };
});

// getSession() -> auth() needs a Next request context; tests control it directly
vi.mock("@/lib/session", () => ({ getSession: vi.fn(async () => null) }));
```

**`tests/setup/integration.ts`** (F3, F4):

```ts
import os from "node:os";
import path from "node:path";
import { beforeAll, beforeEach, vi } from "vitest";

// one DB file per worker; set before any test file imports @/db
const worker = process.env.VITEST_POOL_ID ?? "0";
process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), `cineradar-vitest-${worker}.db`)}`;
process.env.DATABASE_AUTH_TOKEN = "";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

// dynamic import so @/db is created after DATABASE_URL is set
beforeAll(async () => (await import("../helpers/db")).migrateTestDb());
beforeEach(async () => (await import("../helpers/db")).resetDb());
```

**`tests/setup/integration.global.ts`** (F5):

```ts
import { readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateTestMigrations } from "../helpers/migrations"; // D5: rm folder + drizzle-kit generate

export default function setup() {
  generateTestMigrations();
  for (const f of readdirSync(os.tmpdir()).filter((f) => f.startsWith("cineradar-vitest-"))) {
    rmSync(path.join(os.tmpdir(), f), { force: true });
  }
}
```

**`drizzle.test.config.ts`**. `generate` never connects, so the credentials are dummies that only satisfy the type:

```ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema/*",
  out: "./tests/.generated/migrations",
  driver: "turso",
  dbCredentials: { url: "file:unused.db" },
} satisfies Config;
```

**`tests/setup/components.tsx`**:

```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup()); // no `globals: true`, so RTL can't auto-register this

vi.mock("next/navigation", () => {
  const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() };
  return {
    useRouter: () => router, // same object every call: tests read it via useRouter()
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
    redirect: vi.fn(),
  };
});
// plain <img>: next/image's default loader rewrites src to /_next/image?... outside Next
vi.mock("next/image", () => ({
  default: ({ priority, fill, ...props }: Record<string, unknown>) => <img {...props} />,
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));
// server actions pull in next-auth and the DB
vi.mock("@/app/actions", () => ({ SignOut: vi.fn(), DeleteUser: vi.fn() }));
vi.mock("react-google-recaptcha-v3", () => ({
  useGoogleReCaptcha: vi.fn(() => ({ executeRecaptcha: undefined })),
  GoogleReCaptchaProvider: ({ children }: { children: React.ReactNode }) => children,
}));
```

### 3.3 Helpers

**`tests/helpers/db.ts`**. This runs against the real per-worker SQLite file:

```ts
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, sessions, users } from "@/db/schema/users";
import { lists } from "@/db/schema/lists";

export type ListMovie = NonNullable<typeof lists.$inferSelect.movies>[number];

export const migrateTestDb = () => migrate(db, { migrationsFolder: "tests/.generated/migrations" });

export async function resetDb() {
  const triggers = await db.all<{ name: string }>(
    sql`select name from sqlite_master where type = 'trigger' and name like 'force_fail_%'`,
  );
  for (const t of triggers) await db.run(sql.raw(`drop trigger "${t.name}"`));
  await db.delete(lists);
  await db.delete(sessions);
  await db.delete(accounts);
  await db.delete(users);
}

export async function seedUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const id = overrides.id ?? crypto.randomUUID();
  const user = { id, name: "Test User", email: `${id}@test.local`, image: "/CineRadarLogo.png", ...overrides };
  await db.insert(users).values(user);
  return user as Required<typeof user>;
}

export const seedList = (userId: string, movies: ListMovie[] | null) =>
  db.insert(lists).values({ userId, movies });

export async function getMovies(userId: string) {
  const rows = await db.select({ movies: lists.movies }).from(lists).where(eq(lists.userId, userId));
  return rows[0]?.movies; // undefined = no row
}

// makes the next INSERT/UPDATE/DELETE on `table` fail inside SQLite (removed by resetDb)
export const forceFailure = (op: "INSERT" | "UPDATE" | "DELETE", table: string) =>
  db.run(sql.raw(
    `create trigger "force_fail_${op}_${table}" before ${op} on "${table}" begin select raise(abort, 'forced failure'); end`,
  ));
```

Use triggers for write failures, because they exercise real rollback behaviour. Use `vi.spyOn(db, "select")` only where there is no SQL-level hook, such as B8.

**`tests/helpers/factories.ts`**:
- `makeMovie(overrides)` returns `{ image: "/img.jpg", name: "Fury", movieId: 1, rating: 0, status: "Completed", type: "movie" }` with the overrides applied.
- `makeUser()` returns a session-user object.
- `makeSession(user)` returns `{ user, expires: <ISO string 1 day ahead> }`.

**`tests/helpers/next.ts`**. The redirect mock must **throw**, like the real one. Otherwise `DeleteUser`'s failure path would carry on to the success redirect:

```ts
export class RedirectError extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}
// usage in a test file:
// vi.mock("next/navigation", async () => {
//   const { RedirectError } = await import("../helpers/next");
//   return { redirect: vi.fn((url: string) => { throw new RedirectError(url); }) };
// });
```

**`tests/helpers/requests.ts`**:

```ts
export const jsonRequest = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
```

**`tests/helpers/stream.ts`**. This covers both sides of the NDJSON protocol:

```ts
const encoder = new TextEncoder();

export const ndjson = (...events: object[]) => events.map((e) => JSON.stringify(e) + "\n").join("");

// fixed chunks: the chunk boundaries are exactly what the test passes in
export const streamResponse = (chunks: string[], init?: ResponseInit) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        chunks.forEach((ch) => c.enqueue(encoder.encode(ch)));
        c.close();
      },
    }),
    init,
  );

// open stream the test drives step by step (live-rendering assertions)
export function controlledStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) });
  return {
    response: new Response(body),
    push: (text: string) => controller.enqueue(encoder.encode(text)),
    close: () => controller.close(),
  };
}

export async function readNdjson(res: Response) {
  const text = await res.text();
  return { text, events: text.split("\n").filter(Boolean).map((l) => JSON.parse(l)) };
}

// Gemini SDK side: async iterable of interaction events, optionally throwing midway
export async function* geminiEvents(events: object[], throwAfter?: number) {
  for (const [i, e] of events.entries()) {
    if (i === throwAfter) throw new Error("stream broke");
    yield e;
  }
}
```

**`tests/helpers/tmdb.ts`**. Routes a mocked `fetch` by URL pathname and loads fixtures from `tests/fixtures/tmdb`:

```ts
import { vi } from "vitest";

export function mockTmdb(routes: Record<string, unknown | Response>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    const hit = routes[url.pathname];
    if (hit === undefined) return new Response("not mocked", { status: 404 });
    return hit instanceof Response ? hit : Response.json(hit);
  });
}
export const lastTmdbUrl = (spy: ReturnType<typeof mockTmdb>) => new URL(String(spy.mock.lastCall![0]));
```

### 3.4 Conventions

- **Known bugs:** write the test with the *correct* expected behaviour and declare it with `test.fails("[B1] …", …)`. It passes while the bug exists. When someone fixes the bug, Vitest reports "expected to fail but passed", which prompts them to change it to `test`. In Playwright, call `test.fail(true, "[B1] …")` at the top of the test body. Search the codebase for `[B` to find them all.
- **Not yet specified behaviour** (e.g. payload validation): `test.todo`.
- **Env:** use `vi.stubEnv(name, value)`. `unstubEnvs` restores the value after each test. For values read at **import time** (`CHAT_MODEL`), call `vi.resetModules()`, stub the env, then `await import(...)`.
- **Timers:** use fake timers only in the tests that need them. When a test also streams, fake only `Date` (`vi.useFakeTimers({ toFake: ["Date"] })`).
- **Selectors:** prefer roles and labels. Icon-only buttons have no accessible name today. See the small code changes in 4.8.

---

## 4. Playwright infrastructure

### 4.1 Architecture

```
Playwright ──browser──▶ Next server (:3100 / :3101 / :3102, own distDir)
   │                       │  TMDB_BASE_URL ──▶ mock TMDB (node http, :4010, fixture-driven)
   │                       │  DATABASE_URL  ──▶ libsql-server (Docker, :8089)  ◀── seeding (fixtures)
   │                       └  Gemini / siteverify: never called (stubbed in browser)
   └─ page.route: image.tmdb.org, youtube.com, google.com/recaptcha, /api/assistant, /api/recaptcha
```

**Variants** (F8). One Next server per Playwright invocation, chosen by `E2E_VARIANT`:

| Variant | Port | Env differences | Specs |
|---|---|---|---|
| `default` | 3100 | `AI_CHAT_ENABLED=true`, reCAPTCHA keys `""` | everything except `variants/` |
| `chat-disabled` | 3101 | `AI_CHAT_ENABLED=""` | `variants/chat-disabled.spec.ts` |
| `recaptcha` | 3102 | both reCAPTCHA keys set to dummy values | `variants/recaptcha.spec.ts` |

Each variant gets its own port and `distDir`. Because of that, `reuseExistingServer` can never reuse the wrong variant, and the E2E servers never clash with the developer's own `npm run dev` on `.next`.

### 4.2 `tests/e2e/env.ts` + `playwright.config.ts`

```ts
// tests/e2e/env.ts
export type Variant = "default" | "chat-disabled" | "recaptcha";
export const VARIANT = (process.env.E2E_VARIANT ?? "default") as Variant;
export const PORT = { default: 3100, "chat-disabled": 3101, recaptcha: 3102 }[VARIANT];
export const BASE_URL = `http://localhost:${PORT}`;
export const TMDB_PORT = 4010;
export const TMDB_URL = `http://127.0.0.1:${TMDB_PORT}`;
export const DB_PORT = 8089;
export const DB_URL = process.env.E2E_DATABASE_URL ?? `http://127.0.0.1:${DB_PORT}`;
export const LIBSQL_IMAGE = "ghcr.io/tursodatabase/libsql-server:v0.24.33"; // D9
```

The config below is abridged. The real `playwright.config.ts` also has `forbidOnly: isCI`, `outputDir: test-results/<variant>`, and `launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }` on the project (D10, D11). It starts the DB with `docker run --rm --name cineradar-e2e-db -p 8089:8080 ${LIBSQL_IMAGE}` (D7).

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";
import { BASE_URL, DB_PORT, DB_URL, PORT, TMDB_PORT, VARIANT } from "./tests/e2e/env";

const isCI = !!process.env.CI;

const appEnv = {
  DATABASE_URL: DB_URL,
  DATABASE_AUTH_TOKEN: "",
  TMDB_BASE_URL: `http://127.0.0.1:${TMDB_PORT}/3`,
  TMDB_ACCESS_TOKEN: "e2e-tmdb-token",
  AUTH_SECRET: "e2e-auth-secret-e2e-auth-secret-e2e",
  AUTH_URL: BASE_URL, // F9
  NEXTAUTH_URL: BASE_URL,
  AUTH_TRUST_HOST: "true",
  AUTH_GITHUB_ID: "e2e-github-id",
  AUTH_GITHUB_SECRET: "e2e",
  AUTH_GOOGLE_ID: "e2e-google-id",
  AUTH_GOOGLE_SECRET: "e2e",
  GEMINI_API_KEY: "e2e-not-a-real-key",
  GEMINI_MODEL: "e2e-model",
  AI_CHAT_ENABLED: VARIANT === "chat-disabled" ? "" : "true", // "" still overrides .env (F10)
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: VARIANT === "recaptcha" ? "e2e-site-key" : "",
  RECAPTCHA_SECRET_KEY: VARIANT === "recaptcha" ? "e2e-secret-key" : "",
  NEXT_DIST_DIR: `.next-e2e-${VARIANT}`,
};

export default defineConfig({
  testDir: "tests/e2e",
  testIgnore: VARIANT === "default" ? ["variants/**"] : undefined,
  testMatch: VARIANT === "default" ? undefined : [`variants/${VARIANT}.spec.ts`],
  fullyParallel: true, // safe: every test seeds its own user (4.6)
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: [["html", { outputFolder: `playwright-report/${VARIANT}`, open: "never" }], ["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  expect: { timeout: 10_000 }, // first compile in `next dev` is slow
  use: { baseURL: BASE_URL, trace: "on-first-retry", screenshot: "only-on-failure" },
  projects: [{ name: `chromium-${VARIANT}`, use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    ...(process.env.E2E_DATABASE_URL
      ? []
      : [{
          command: `docker run --rm -p ${DB_PORT}:8080 ghcr.io/tursodatabase/libsql-server:latest`, // pin a tag
          url: `http://127.0.0.1:${DB_PORT}/health`,
          reuseExistingServer: !isCI,
          timeout: 120_000,
        }]),
    {
      command: "node tests/e2e/mocks/tmdb-server.mjs",
      url: `http://127.0.0.1:${TMDB_PORT}/__health`,
      reuseExistingServer: !isCI,
      env: { TMDB_MOCK_PORT: String(TMDB_PORT) },
    },
    {
      // CI: production build (no dev overlay, faster pages); local: dev server
      command: isCI ? `npx next build && npx next start -p ${PORT}` : `npx next dev -p ${PORT}`,
      url: `${BASE_URL}/about`,
      reuseExistingServer: !isCI,
      timeout: 300_000,
      env: appEnv, // merged over process.env by Playwright
    },
  ],
});
```

Playwright starts `webServer` entries before `globalSetup`, so the DB is up when migrations run.

### 4.3 E2E database

- **Server:** `ghcr.io/tursodatabase/libsql-server:v0.24.33` (sqld) runs without auth when no JWT key is set, so the empty `DATABASE_AUTH_TOKEN` is ignored. Playwright kills only the `docker run` client, so the container (`cineradar-e2e-db`) **outlives the run**. Locally, `reuseExistingServer` picks it up next time, which is fine because global setup resets the schema. Stop it with `docker stop cineradar-e2e-db`. CI uses a service container instead (D7). Without Docker, set `E2E_DATABASE_URL=http://127.0.0.1:8080` and run `turso dev --port 8080`.
- **`tests/e2e/global-setup.ts`:**
  1. Regenerate `tests/.generated/migrations` with `generateTestMigrations()`.
  2. `createClient({ url: DB_URL })`, then retry `select 1` for up to about 30 s.
  3. Drop every table (except `sqlite_%`, `libsql_%` and `_litestream%`), including `__drizzle_migrations`. Retry until parents are free of FK references. This matters because the regenerated migration has a new hash, so a reused DB would otherwise replay `CREATE TABLE` (D6).
  4. `migrate(drizzle(client), { migrationsFolder })`.
  5. Locally only (`!CI`): `fetch` `/`, `/search`, `/about`, `/signin`, `/search/movie/550` and `/search/tv/1399` once, so `next dev` compiles them before the timed tests start.

### 4.4 Mock TMDB server (`tests/e2e/mocks/tmdb-server.mjs`)

A dependency-free `node:http` server. Every scenario is chosen by the request input (F12):

| Request (path after `/3`) | Response |
|---|---|
| `GET /__health` | `200 {ok:true}` |
| `GET /configuration/languages` | `fixtures/tmdb/languages.json` (e.g. en, fr, lt, ja) |
| `GET /discover/{movie,tv}` | Generated page: `total_pages: 800` (checks the 500 cap). Titles are `Trending {type} p{page} #{i}`. |
| `GET /search/{movie,tv}?query=Q` | Generated page. Titles are `{Q with "\|" → " "} {type} p{page} #{i}`, ids are `page*100+i`, `total_pages: 50`. |
| `query` contains `__empty__` | `{ page:1, results: [], total_pages: 0, total_results: 0 }` |
| `query` contains `__pages3__` | `total_pages: 3` |
| `query` contains `__slow__` | Delays 2.5 s, then responds normally (skeleton test) |
| `query` contains `__error__`, or any id `999999` | `500` |
| `GET /movie/:id`, `GET /tv/:id` | `movie-550.json` / `tv-1399.json` with `id` replaced by the requested id |
| `GET /{movie,tv}/:id/videos`, `/images`, `/reviews` | `videos.json`, `images.json` (12 backdrops), `reviews.json` (12 reviews: one 900+ chars, one with `avatar_path: null`, one with `<script>`/`onerror`/`javascript:` payloads) |
| `GET /__requests`, `DELETE /__requests` | Returns / clears the recorded `{ path, query, authorization }` list. Assertions filter it by a unique query per test. |

Generated result objects include every field `MovieCard` reads: `id`, `title` (movie) or `name` (tv), `poster_path`, `backdrop_path`, `release_date`/`first_air_date`, `vote_average`, `vote_count`. Result #6 on each page has `poster_path: null, backdrop_path: null` to exercise `NoImage`.

### 4.5 Browser-level stubs

These run in an auto fixture, so every test gets them:
- `https://image.tmdb.org/**` → `tests/fixtures/pixel.png`
- `https://www.youtube.com/**` → `<html></html>`
- **Not** stubbed by default: `/api/assistant` and `/api/recaptcha`. Chat specs install them explicitly (4.7), so any unexpected call surfaces as a failure.

### 4.6 Auth and data fixtures (`tests/e2e/fixtures.ts`)

With the Drizzle adapter, next-auth uses **database sessions**. The session cookie holds the raw `sessionToken`. Over plain http it is named `authjs.session-token` (verified in `@auth/core/lib/utils/cookie.js`). So logging in is: insert a `user` row and a `session` row, then set the cookie.

```ts
import { test as base, expect } from "@playwright/test";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { randomUUID } from "node:crypto";
import { sessions, users } from "../../src/db/schema/users";
import { BASE_URL, DB_URL } from "./env";

export type TestUser = { id: string; name: string; email: string; image: string };

export const test = base.extend<
  { stubAssets: void; seedUser: (o?: Partial<TestUser>) => Promise<TestUser>; loginAs: (o?: Partial<TestUser>) => Promise<TestUser> },
  { db: LibSQLDatabase }
>({
  db: [async ({}, use) => {
    const client = createClient({ url: DB_URL });
    await use(drizzle(client));
    client.close();
  }, { scope: "worker" }],

  stubAssets: [async ({ page }, use) => {
    await page.route("https://image.tmdb.org/**", (r) => r.fulfill({ path: "tests/fixtures/pixel.png" }));
    await page.route("https://www.youtube.com/**", (r) => r.fulfill({ body: "<html></html>", contentType: "text/html" }));
    await use();
  }, { auto: true }],

  seedUser: async ({ db }, use) => {
    await use(async (o = {}) => {
      const id = o.id ?? randomUUID();
      // local image: avoids stubbing avatar hosts
      const user = { id, name: `E2E ${id.slice(0, 6)}`, email: `${id}@e2e.test`, image: "/CineRadarLogo.png", ...o };
      await db.insert(users).values(user);
      return user;
    });
  },

  loginAs: async ({ context, db, seedUser }, use) => {
    await use(async (o) => {
      const user = await seedUser(o);
      const token = randomUUID();
      await db.insert(sessions).values({ sessionToken: token, userId: user.id, expires: new Date(Date.now() + 86_400_000) });
      await context.addCookies([{ name: "authjs.session-token", value: token, url: BASE_URL, httpOnly: true, sameSite: "Lax" }]);
      return user;
    });
  },
});
export { expect };
```

`tests/e2e/helpers/db.ts` has `seedList(db, userId, movies)`, `getMovies(db, userId)`, `userExists(db, id)` and `sessionCount(db, userId)`, which mirror the Vitest helpers.

Parallel safety: every test creates its own user(s) with random ids, and list assertions only look at that user's row. Nothing truncates tables mid-run.

### 4.7 Chat stubs (`tests/e2e/helpers/chat.ts`)

```ts
import type { Page } from "@playwright/test";

type Reply = { status?: number; events?: ChatStreamEvent[]; hold?: Promise<void> };

export async function stubAssistant(page: Page, reply: (body: any, n: number) => Reply | Promise<Reply>) {
  const calls: any[] = [];
  await page.route("**/api/assistant", async (route) => {
    const body = route.request().postDataJSON();
    calls.push(body);
    const { status = 200, events = [], hold } = await reply(body, calls.length);
    await hold; // lets a test observe the loading state
    await route.fulfill({
      status,
      contentType: "application/x-ndjson",
      body: events.map((e) => JSON.stringify(e) + "\n").join(""),
    });
  });
  return calls;
}

export const answer = (id: string, markdown: string): ChatStreamEvent[] => [
  { type: "start", interactionId: id },
  { type: "delta", text: markdown.slice(0, 20) },
  { type: "delta", text: markdown.slice(20) },
  { type: "done", interactionId: id },
];
```

`route.fulfill` delivers the body in one piece. Incremental rendering is covered in the component test (6.3.1). There is one optional E2E check in 6.5.2.

### 4.8 Small repo changes that the infrastructure needs

1. `next.config.mjs`: `distDir: process.env.NEXT_DIST_DIR || ".next"`.
2. `tsconfig.json`:
   - Add `"tests"` to `exclude`.
   - Pre-add `.next-e2e-default/types/**/*.ts`, `.next-e2e-chat-disabled/types/**/*.ts` and `.next-e2e-recaptcha/types/**/*.ts` to `include`. `next dev` otherwise writes these into `tsconfig.json` on each run and leaves the git tree dirty.
3. `.gitignore`: `.next-e2e-*/`, `tests/.generated/`, `playwright-report/`, `test-results/`, `coverage/` (already there).
4. Accessibility hooks, which are also good UX:
   - `aria-label="Edit list entry"` on the [EditListBtn](src/Components/ui/EditListBtn.tsx) trigger.
   - `aria-label="Remove from list"` on the [DeleteListBtn](src/Components/ui/DeleteListBtn.tsx) trigger.
   - `aria-label="Toggle menu"` on the [Navbar](src/Components/Navbar.tsx) mobile button.
   - `aria-label="Account menu"` on the [AuthBtn](src/Components/AuthBtn.tsx) avatar button.
   - Optional: `data-testid="search-results-skeleton"` on [SearchResultsSkeleton](src/Components/skeletons/SearchResultsSkeleton.tsx).
5. Move `getTitle` from `src/app/search/page.tsx` to `src/lib/searchTitle.ts` (F13).

---

## 5. Scripts and CI

`package.json`:

```json
"test": "vitest",
"test:run": "vitest run",
"test:unit": "vitest run --project unit",
"test:integration": "vitest run --project integration",
"test:components": "vitest run --project components",
"test:coverage": "vitest run --coverage",
"test:e2e": "playwright test",
"test:e2e:variants": "E2E_VARIANT=chat-disabled playwright test && E2E_VARIANT=recaptcha playwright test",
"test:e2e:ui": "playwright test --ui",
"typecheck:tests": "tsc -p tests/tsconfig.json --noEmit"
```

(Use `cross-env` for the variants script if Windows support matters. `--pass-with-no-tests` was dropped once the variant specs existed (D8).)

`.github/workflows/tests.yml`:

```yaml
name: tests
on: [push, pull_request]
jobs:
  vitest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm run typecheck:tests
      - run: npm run test:coverage
  e2e:
    runs-on: ubuntu-latest
    services:
      # one DB for all variants: global-setup drops and re-migrates it on every run (D7)
      libsql:
        image: ghcr.io/tursodatabase/libsql-server:v0.24.33 # keep in sync with tests/e2e/env.ts
        ports: ["8089:8080"]
    env:
      E2E_DATABASE_URL: http://127.0.0.1:8089
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - run: npm run test:e2e:variants
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with: { name: playwright-report, path: playwright-report/ }
```

Note: `next/font/google` downloads the Sora font at build/compile time, so E2E needs network access. That's fine on GitHub runners, but it will fail in a fully offline sandbox.

---

## 6. Test-by-test implementation

Each table row is one case from TESTING_PLAN.md, followed by how to implement it. "fails" means `test.fails` / `test.fail()` (section 3.4).

### 6.1 Unit tests (`unit` project, node)

#### 6.1.1 `tests/unit/lib/utils.test.ts`

Helper: `const qp = (url: string) => new URL(url, "http://x").searchParams`. Assertions round-trip through `URLSearchParams` instead of comparing encoded strings.

| Case | Implementation |
|---|---|
| Starts with `/search?` | `expect(buildSearchURL({})).toBe("/search?")`, plus `toMatch(/^\/search\?/)` for a populated input. |
| Trims `query` | `qp(buildSearchURL({ query: "  Fury  " })).get("query") === "Fury"`. |
| Omits empty fields | `buildSearchURL({ query: "", language: "", year: "" })` → `"/search?"`. `{ query: undefined }` gives the same. |
| `adult` only when truthy | `it.each([[true, "true"], [false, null], [undefined, null]])` → `qp(...).get("adult")`. |
| Invalid `btn` throws | `expect(() => buildSearchURL({ btn: "anime" })).toThrow(ZodError)` (import `ZodError` from `zod`). |
| `page` handling | `it.each([[0, "0"], [3, "3"], [undefined, null]])` → `qp(buildSearchURL({}, page)).get("page")`. |
| Special characters | `it.each(["Tom & Jerry", "#1 hit", "what?", "Amélie", "東京物語"])` → `get("query")` equals the input, and the URL has no raw space, `#`, or second `?`. |
| Unknown keys ignored | `[...qp(buildSearchURL({ query: "x", foo: "bar" })).keys()]` → `["query"]`. |
| `adult: "false"` → true | Named "pins current behaviour: string 'false' coerces to true". Expect `get("adult") === "true"`. |
| `formatCurrency` table | `it.each([[0,"$0"],[999,"$999"],[1000,"$1.0k"],[1_500_000,"$1.5M"],[2_300_000_000,"$2.3B"],[1e6,"$1.0M"],[1e9,"$1.0B"]])`. |
| `formatCurrency(999_999)` | Pin `"$1000.0k"` with a comment. If the rounding gets fixed, change the test to `"$1.0M"`. |
| `cn` | `cn("p-2", "p-4") === "p-4"`; `cn("a", false, null, undefined, "c") === "a c"`. |

#### 6.1.2 `tests/unit/lib/validation.test.ts`

| Case | Implementation |
|---|---|
| Empty object | `movieFilterSchema.safeParse({}).success === true` |
| All fields | Parse `{ query, language, year, adult: true, btn: "tv", page: "2" }` → `toEqual` the input. |
| Invalid `btn` | `safeParse({ btn: "x" }).success === false`, and the error path is `["btn"]`. |
| `adult` coercion | `it.each([["on", true], ["", false], [1, true], [0, false]])` → `.parse({ adult }).adult`. |

#### 6.1.3 `tests/unit/lib/myList.test.ts`

`vi.mock("@/db", () => ({ db: {} }))`. This module imports the DB, but `filteredMovies` never touches it. The fixture is 6 movies covering both types, all 3 statuses and ratings `0, 3, 7, 10`, built with `makeMovie`.

| Case | Implementation |
|---|---|
| `type` filter | `both` → length 6. `movie`/`tv` → `every(m => m.type === type)` and correct counts. |
| `status` mapping | `it.each([["completed","Completed"],["planning","Planning to watch"],["watching","Watching"]])` → every item has the mapped status. `all` → 6. |
| Combined filters | `{ type: "tv", status: "watching" }` → exactly the expected names. |
| Rating sort | `asc` → ratings are non-decreasing, `desc` → non-increasing (compare `map(m => m.rating)` to a sorted copy). |
| Unrated position | `asc` → `result[0].rating === 0`. `desc` → `result.at(-1).rating === 0`. |
| No mutation | Pass `Object.freeze([...fixture])` (an in-place sort would throw `TypeError`). Also check `input` still `toEqual(structuredClone(original))` afterwards, for every filter combination (`it.each`). |
| Empty input | `filteredMovies([], defaults)` → `[]`. |

#### 6.1.4 `tests/unit/lib/loaderWords.test.ts`

| Case | Implementation |
|---|---|
| New array, same elements | `out !== input`, `out.length === input.length`, `[...out].sort()` equals `[...input].sort()`. |
| No mutation | Freeze the input and compare it to a copy afterwards. |
| Deterministic | `vi.spyOn(Math, "random").mockReturnValue(0)` → `shuffle([1,2,3,4])` equals `[2,3,4,1]` (Fisher–Yates with j=0 every step). |
| Edge sizes | `shuffle([])` → `[]`, `shuffle(["a"])` → `["a"]`. |

#### 6.1.5 `tests/unit/lib/chatConfig.test.ts`

| Case | Implementation |
|---|---|
| Date in prompt | `buildSystemInstruction(new Date("2026-03-04T12:00:00Z"))` contains `"Today's date is 2026-03-04."`. The function uses UTC, so the result doesn't depend on the timezone. |
| Link formats present | `toContain("(/search?query=Title&btn=movie&year=YYYY)")` and `toContain("(/search?query=Title&btn=tv)")`. |
| Links match the app's contract | Extract every `(/search?...)` link from the prompt's example section with a regex. For each, `movieFilterSchema.parse(Object.fromEntries(new URL(l, "http://x").searchParams))` succeeds, and `btn` is `movie` or `tv`. This catches prompt edits that break the search page. |
| `CHAT_MODEL` default / env | `vi.resetModules(); vi.stubEnv("GEMINI_MODEL", ""); (await import("@/lib/chatConfig")).CHAT_MODEL === "gemini-3.5-flash-lite"`. Then the same with `"custom-model"`. |

#### 6.1.6 `tests/unit/lib/recaptcha.test.ts`

`it.each` over the 4 combinations of `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` / `RECAPTCHA_SECRET_KEY` as `"k"` or `""` (via `vi.stubEnv`). Only `k, k` → `true`.

#### 6.1.7 `tests/unit/auth.test.ts`

Mocks: `vi.mock("@/db", () => ({ db: {} }))` and `vi.mock("@auth/drizzle-adapter", () => ({ DrizzleAdapter: vi.fn(() => ({})) }))`. `DrizzleAdapter({})` would throw on the unknown DB type. next-auth itself loads because of F6. Call `authConfig.callbacks.authorized({ auth, request: { nextUrl: new URL(href) } } as any)`.

| Case | Implementation |
|---|---|
| Logged-out redirect | `it.each(["http://localhost:3000/my-list", "http://localhost:3000/my-list?type=tv"])`. The result is a `Response` with `status 302`. `new URL(res.headers.get("location")!)` has pathname `/api/auth/signin` and `searchParams.get("callbackUrl") === href`. |
| Logged in | `auth: { user: { id: "u1" } }` on `/my-list` → `true`. |
| Public paths | `it.each(["/", "/search", "/about"])`, logged out and logged in → `true`. |
| (extra) prefix match | `/my-listing` is also protected (`startsWith`). Pin the current behaviour with a comment. |
| `session` callback | `await authConfig.callbacks.session({ session: { user: {} }, user: { id: "u1" } } as any)` → `.user.id === "u1"`. |

#### 6.1.8 `tests/unit/app/search-metadata.test.ts` (+ `tests/unit/lib/searchTitle.test.ts`)

Import `generateMetadata` from `@/app/search/page`. That also imports the component tree. It's safe because `@/lib/session` is mocked globally and `SearchResults`/`MovieCard` are only imported, never called.

| Case | Implementation |
|---|---|
| No query | `generateMetadata({ searchParams: {} } as any).title === "Manual search \| CineRadar"` |
| With query | `{ query: "Fury" }` → `"Results for: Fury in EN language \| CineRadar"` (the language defaults to `en`). |
| Language/year/adult | `{ query: "Fury", language: "fr", year: "2014", adult: "true" }` → `"Results for: Fury in FR language, 2014 year, including adult. \| CineRadar"`. `adult: "false"` → no "including adult". |
| `getTitle` direct (after the 4.8 move) | Same matrix called directly. **fails [B7]:** `getTitle({ btn: "tv" })` matches `/tv/i`. This means `getTitle` must accept `btn`. |

### 6.2 Integration tests (`integration` project, node + real SQLite file)

The common setup comes from `tests/setup/integration.ts`: migrations, a reset before each test, and the `next/cache` mock. Each file that needs a session adds:

```ts
import { asUser } from "../../helpers/auth"; // D12: shared helper
vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
```

#### 6.2.1 `tests/integration/api/add-to-list.test.ts`

`const put = (body) => PUT(jsonRequest("PUT", "/api/add-to-list", body))`. The base body is `{ userId, movieId: "550", title: "Fight Club", image: "/i.jpg", status: "Completed", rating: "8", type: "movie" }`. Every test seeds its user first.

| Case | Implementation |
|---|---|
| No row → insert | `put(base)` → `await getMovies(user.id)` equals `[{ name:"Fight Club", image:"/i.jpg", status:"Completed", rating:8, movieId:550, type:"movie" }]`. |
| Append | `seedList(user.id, [makeMovie({ movieId: 1 })])` then `put(base)` → length 2, and the first entry is unchanged. |
| Replace existing | Seed `movieId: 550, status: "Planning to watch"`, then `put({ ...base, status: "Watching", rating: "3" })` → length 1, status/rating updated. |
| `rating` conversion | `it.each([["", 0], ["7", 7]])` → the stored `rating` is a number (`typeof === "number"`). |
| `movieId` numeric | Stored `movieId === 550` (a number, not a string). |
| Success response | `await res.json()` equals `{ addToListResult: "success" }`. `vi.mocked(revalidatePath)` was called with `("/my-list", "page")`. |
| Update fails | Seed a row, then `forceFailure("UPDATE", "lists")` → `{ addToListResult: "fail" }`. `revalidatePath` not called. The list is unchanged. |
| Insert fails | No row, `forceFailure("INSERT", "lists")` → `fail`. `getMovies` is `undefined`. |
| **fails [B8]** select fails | `vi.spyOn(db, "select").mockImplementationOnce(() => { throw new Error("db down"); })`. Expect `await expect(put(base)).resolves.toBeInstanceOf(Response)` and a JSON body of `fail`. Today it rejects. |
| **fails [B4]** tv vs movie | Seed `[makeMovie({ movieId: 550, type: "movie" })]`, `put({ ...base, type: "tv", title: "Show" })` → the list has 2 entries, `{550, movie}` and `{550, tv}`. |
| **fails [B1]** no session | `asUser(null)`, `put(base)` → `res.status === 401`, and `getMovies(user.id)` is `undefined`. |
| **fails [B1]** foreign userId | `asUser(attacker)`, `put({ ...base, userId: victim.id })` → the victim's list is unchanged. The entry goes to the attacker's list (the fixed route must use `session.user.id` and ignore the body). |
| Payload validation | `test.todo` × 3: missing `status`, `type: "anime"`, `rating: "11"`. |

#### 6.2.2 `tests/integration/api/remove-from-list.test.ts`

`const del = (userId, movieId) => DELETE(new Request("http://localhost/api/remove-from-list", { method: "DELETE", headers: { userId, movieId: String(movieId) } }))`.

| Case | Implementation |
|---|---|
| Removes the match | Seed `[550, 1, 2]`, `del(u, 550)` → remaining `[1, 2]` (deep-equal to the original objects). |
| No row → fail | `del(u, 550)` on an unseeded user → `{ addToListResult: "fail" }`. |
| Missing movie → success no-op | Seed `[1]`, `del(u, 999)` → `success`, list unchanged. |
| Update fails | `forceFailure("UPDATE", "lists")` → `fail`, list unchanged. |
| `revalidatePath` | Called with `("/my-list", "page")` on success only. |
| **fails [B4]** | Seed `[{550, movie}, {550, tv}]`. Deleting the movie must leave the TV entry. The fix also needs a `type` header, so the test sends `type: "movie"`. |
| **fails [B2]** | `asUser(null)` → 401 and list unchanged. `asUser(attacker)` + `userId: victim.id` header → the victim's list is unchanged. |

#### 6.2.3 `tests/integration/api/assistant.test.ts`

No DB is needed, but the file lives here to share the node setup. Mock the SDK:

```ts
const { create, ctor } = vi.hoisted(() => ({ create: vi.fn(), ctor: vi.fn() }));
vi.mock("@google/genai", () => ({
  // `function`, not arrow: the route calls `new GoogleGenAI(...)` (Vitest 4)
  GoogleGenAI: vi.fn(function (opts: unknown) {
    ctor(opts);
    return { interactions: { create } };
  }),
}));
beforeEach(() => vi.stubEnv("AI_CHAT_ENABLED", "true"));
const post = (body: unknown) => POST(jsonRequest("POST", "/api/assistant", body) as NextRequest);
```

| Case | Implementation |
|---|---|
| 503 when disabled | `it.each(["", "false", "TRUE"])` stub → `status 503`, and `create` not called. |
| 400 invalid content | `it.each([{}, { content: 42 }, { content: null }, { content: "   " }, { content: "a".repeat(1001) }])` → 400, `create` not called. |
| Max length accepted | `create.mockResolvedValue(geminiEvents([]))`, then `post({ content: "a".repeat(MAX_PROMPT_LENGTH) })` → 200. |
| 400 invalid interaction id | `it.each([42, {}, true])` as `previousInteractionId` → 400. `null` and a missing key → 200. |
| Arguments to Gemini | `vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-05-01T10:00:00Z"))`, then `post({ content: "hi", previousInteractionId: "prev" })`. `create` is called with `objectContaining({ model: CHAT_MODEL, input: "hi", previous_interaction_id: "prev", stream: true, system_instruction: buildSystemInstruction(new Date("2026-05-01T10:00:00Z")) })`. `ctor` is called with `{ apiKey: "test-gemini-key" }`. `null` id → `previous_interaction_id: undefined`. |
| 502 on create failure | `create.mockRejectedValue(new Error("quota"))` → 502. |
| Content-Type | `res.headers.get("content-type") === "application/x-ndjson"`. |
| Event mapping | Feed `[{event_type:"interaction.created",interaction:{id:"i1"}}, {event_type:"step.delta",delta:{type:"text",text:"Hel"}}, {event_type:"step.delta",delta:{type:"thought",text:"hmm"}}, {event_type:"step.delta",delta:{type:"text",text:"lo"}}, {event_type:"interaction.completed",interaction:{id:"i1",status:"completed"}}]` → `readNdjson(res).events` equals `[{type:"start",interactionId:"i1"},{type:"delta",text:"Hel"},{type:"delta",text:"lo"},{type:"done",interactionId:"i1"}]`. |
| Non-completed status | `interaction.completed` with `status: "failed"` → the last event is `{type:"error"}`. |
| `error` event | `{event_type:"error", error:{...}}` → `{type:"error"}`. Silence `console.error` with `vi.spyOn(console, "error").mockImplementation(() => {})`. |
| Throw mid-stream | `geminiEvents([created, delta, completed], 2)` → the events end with `{type:"error"}`, and `res.text()` resolves (the stream closed cleanly). |
| NDJSON framing | `text.endsWith("\n")`, and every `text.split("\n").slice(0,-1)` line passes `JSON.parse`. |
| (extra, B11) | **fails:** `POST(jsonRequest("POST", "/api/assistant", "{not json"))` → 400. |

#### 6.2.4 `tests/integration/api/recaptcha.test.ts`

`beforeEach`: stub `AI_CHAT_ENABLED=true`, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY=site`, `RECAPTCHA_SECRET_KEY=secret`. `const f = vi.spyOn(globalThis, "fetch")`.

| Case | Implementation |
|---|---|
| 503 disabled | Stub `AI_CHAT_ENABLED=""` → 503, `f` not called. |
| 404 not configured | Stub `RECAPTCHA_SECRET_KEY=""` → 404. |
| Calls siteverify | `f.mockResolvedValue(Response.json({ success: true, score: 0.9 }))`. `const u = new URL(f.mock.calls[0][0] as string)`: origin+pathname is `https://www.google.com/recaptcha/api/siteverify`, `secret=secret`, `response=tok`. `f.mock.calls[0][1].method === "POST"`. |
| Success | Score 0.9 → `{ success: true, score: 0.9 }`. |
| Failures | `it.each` over: `{success:true, score:0.5}`, `{success:true, score:0.1}`, `{success:false, score:0.9}`, `new Response("", { status: 500 })`, `f.mockRejectedValue(new TypeError("network"))` → each gives `{ success: false }`. |

#### 6.2.5 `tests/integration/actions.test.ts` (`DeleteUser`)

Mock `@/auth` (above) and `next/navigation` with the throwing `RedirectError` (3.3). Seed each user with a full set of rows: `user`, one `account`, one `session`, and a `lists` row. Add a `seedFullUser()` helper to `tests/helpers/db.ts`.

`const form = (verify, id) => { const f = new FormData(); f.set("verifyInput", verify); f.set("id", id); return f; }`

| Case | Implementation |
|---|---|
| No session | `asUser(null)` → `await DeleteUser(form("Delete account", a.id))` resolves `null`. All of A's rows still exist. `redirect` not called. |
| Wrong text | `asUser(a)`, `form("delete account", a.id)` → `rejects.toMatchObject({ url: "/?deleteAcc=fail" })`. Rows intact. |
| Correct text | `rejects.toMatchObject({ url: "/?deleteAcc=success" })`. The `user`, `account`, `session` and `lists` rows for A are gone. User B's rows are intact. |
| Failure + rollback | `forceFailure("DELETE", "user")` (the last statement in the transaction) → `rejects.toMatchObject({ url: "/?deleteAcc=fail" })`. **All four** of A's rows still exist, which proves the rollback. Silence `console.error`. |
| **fails [B3]** | `asUser(a)`, `form("Delete account", b.id)` → B still exists, and A is deleted (the fixed action ignores the form `id`). |

#### 6.2.6 `tests/integration/lib/myList.test.ts`

| Case | Implementation |
|---|---|
| Returns movies | `seedList(u.id, [m1, m2])` → `getListMovies(u.id)` equals `[m1, m2]`. `cache` is the identity shim, so there is no cross-test caching. |
| No row | `[]` |
| `movies = null` | `seedList(u.id, null)` → `[]` |

### 6.3 Client component tests (`components` project, jsdom)

Common: `const user = userEvent.setup()`. Fetch is `vi.spyOn(globalThis, "fetch")` with per-URL `mockImplementation`. The router comes from `useRouter()` (same object the component gets). Toasts come from `vi.mocked(toast.success)` etc.

#### 6.3.1 `tests/components/ChatAssistant.test.tsx`

Helpers:
- `renderChat({ recaptchaEnabled = false } = {})` returns `{ input: getByPlaceholderText(/Suggest me movies/), submit: getByRole("button", { name: /submit|generating/i }) }`.
- `send(text)` types and submits.
- `routeFetch({ "/api/assistant": [...responses], "/api/recaptcha": [...] })` queues responses per URL and records `JSON.parse(init.body)` per call.

| Case | Implementation |
|---|---|
| Greeting | `renderChat()` with the greeting prop → `getByText(greeting)`. |
| Empty input | `submit` is disabled. `input` has `maxlength="1000"` (`toHaveAttribute("maxlength", String(MAX_PROMPT_LENGTH))`). |
| On submit | Assistant response is `controlledStream().response` (left open). After `send("war films")`: `getByText("war films")` is visible, `input` has value `""` and is disabled, `getByRole("status")` (ThinkingLoader) is present. |
| Deltas appear live | Push `start` + `delta "Hel"` → `await findByText("Hel")`. Push `delta "lo"` → `findByText("Hello")`. The loader is gone once content arrives. |
| Split chunks | `streamResponse(['{"type":"start","interactionId":"i1"}\n{"type":"del', 'ta","text":"Hi"}\n', ndjson(done("i1"))])` → the final message is "Hi". No error text. |
| Many events in one chunk | One chunk containing `ndjson(start, delta "A", delta "B", done)` → "AB". |
| Last line without `\n` | Chunks `[ndjson(start, delta "X"), JSON.stringify(done("i1"))]` → "X" rendered, no error. |
| Blank lines | `["\n\n", ndjson(start, delta "Y"), "\n", ndjson(done)]` → "Y", no error. |
| `done` finalises | After close: the message stays, `queryByRole("status")` is null, `input` is enabled, the button text is "Submit". |
| Continuity | Two full turns with ids `i1`, `i2`. Call 1's body has no `previousInteractionId` key. Call 2's body has `previousInteractionId: "i1"`. |
| Last 10 messages | 6 turns with prompts `p1…p6` and answers `a1…a6` → `queryByText("p1")` and `queryByText("a1")` are null, `getByText("p2")` is present. The greeting is always present. |
| Errors | `it.each` over: `new Response("", { status: 500 })`, `new Response(null)` (null body), `streamResponse([ndjson(start, {type:"error"})])`, `streamResponse([ndjson(start, delta "x")])` (no `done`) → `await findByText("Unfortunately an error occurred. Try again later.")`, and the input is re-enabled. Silence `console.error`. |
| Reset after failure | Turn 1 OK (`i1`). Turn 2 returns 500. Turn 3's body has **no** `previousInteractionId`. |
| Error clears | A failed turn, then a successful turn → the error text is gone. |
| reCAPTCHA order | `vi.mocked(useGoogleReCaptcha).mockReturnValue({ executeRecaptcha: vi.fn().mockResolvedValue("tok") } as any)`, `renderChat({ recaptchaEnabled: true })`. The fetch URL order is `["/api/recaptcha", "/api/assistant"]`, the recaptcha body is `{ recaptchaToken: "tok" }`, and `executeRecaptcha` was called with `"AIchatSubmit"`. |
| reCAPTCHA failure | `/api/recaptcha` → `Response.json({ success: false })`. Use `vi.useFakeTimers({ shouldAdvanceTime: true })` and `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`. Expect "Recaptcha failed to verify!" to be visible. Then `act(() => vi.advanceTimersByTime(3000))` → it's gone. `/api/assistant` never called. |
| reCAPTCHA not ready | `executeRecaptcha: undefined` → submit → `fetch` not called at all. |
| Legal notice | `getByText(/protected by reCAPTCHA/)` present with `recaptchaEnabled`, absent without it. |
| reCAPTCHA disabled | The only fetch URL is `/api/assistant`. |

#### 6.3.2 `tests/components/AssistantMessage.test.tsx`

| Case | Implementation |
|---|---|
| Labels | `role: "user"` → `getByText("You:")`. `assistant` → `getByText("CineRadar AI:")` and `getByAltText("CineRadar Bot")`. |
| Markdown | Content `"1. **Fury** — [Fury](/search?query=Fury&btn=movie&year=2014)\n2. Two"` → 2 `listitem`s, and a `strong` with "Fury" (`container.querySelector("strong")`). |
| Internal links | `getByRole("link", { name: "Fury" })` has `href="/search?query=Fury&btn=movie&year=2014"` and no `target` attribute. |
| External links | `it.each(["https://example.com", "mailto:a@b.co", "//evil.example"])` → `target="_blank"`, `rel="noreferrer"`. |
| `javascript:` | `[x](javascript:alert(1))` → the link's `href` does not match `/alert/`. react-markdown 8's default `transformLinkUri` rewrites it to `javascript:void(0)`, which is harmless. Optionally tighten the component to render plain text for non-http(s)/mailto schemes, and assert that. |
| Raw HTML | Content `<img src=x onerror="alert(1)"><script>alert(1)</script>` → `container.querySelector("img[onerror], script")` is null. |
| Children override | Render with `<span>loader</span>` children and some content → "loader" is shown, the content is not. |

#### 6.3.3 `tests/components/ThinkingLoader.test.tsx`

Use single-character words (`["A","B","C"]`) so `getByText` matches the per-letter spans.

| Case | Implementation |
|---|---|
| Start word | `startIndex={4}` → `getByText("B")`. |
| Rotation + wrap | `vi.useFakeTimers()`. `act(() => vi.advanceTimersByTime(4000))` → "C". Again → "A". |
| Cleanup | `unmount()` → `vi.getTimerCount() === 0`. |

#### 6.3.4 `tests/components/ChatSubmitBtn.test.tsx`

`it.each([[false,false,"Submit",false],[true,false,"Generating...",true],[false,true,"Submit",true]])` → checks the button text and `toBeDisabled()`.

#### 6.3.5 `tests/components/AddToListBtn.test.tsx`

Props: `{ user: makeUser(), movieId: 550, title: "Fight Club", image: "/i.jpg", type: "movie" }`. `open()` clicks `getByRole("button", { name: /add to list/i })`. Query inside the dialog with `within(getByRole("dialog"))`.

| Case | Implementation |
|---|---|
| Opens dialog | After `open()` → `getByRole("dialog")` with "Choose options to add to the list.". |
| Required/optional | `getByLabelText("Status:")` `toBeRequired()` and `toBeInvalid()` while empty. `getByLabelText("Rating (optional):")` is not required. |
| Logged out | `user: undefined`. Select a status, submit → `toast.warning` called with `("Failed to add", objectContaining({ description: "You need to be logged in!" }))`. `fetch` not called. `queryByRole("dialog")` is null. |
| Request body | Select "Completed" and "8", submit → `fetch` called with `("/api/add-to-list", objectContaining({ method: "PUT" }))`. `JSON.parse(body)` equals `{ userId: user.id, movieId: "550", title: "Fight Club", image: "/i.jpg", status: "Completed", rating: "8", type: "movie" }`. |
| Toasts | `Response.json({ addToListResult: "success" })` → `toast.success` called with `"Fight Club was added to the list."`. `"fail"` → `toast.error`. `fetch` rejects → `toast.error`. |
| In-flight | fetch returns a deferred promise. Expect "Adding..." and the submit button disabled. Resolve → it's gone. |
| Close + reset | After each outcome, the dialog closes. Re-open → the status and rating selects have value `""`. |

#### 6.3.6 `tests/components/EditListBtn.test.tsx`

Parametrise the AddToListBtn suite through a shared `describeListForm({ Component, trigger, successText: "Fight Club was updated.", errorText: "Something went wrong while editing the list.", loadingText: "Editing..." })` helper. Extra cases:
- `useRouter().refresh` is called after success **and** after failure.
- URL: assert `fetch.mock.calls[0][0] === "/api/add-to-list"` and fix the component (remove the relative `api/...`). If the fix is deferred, pin `"api/add-to-list"` with a `// B-relative` comment.
- The trigger is found with `getByRole("button", { name: "Edit list entry" })` (the aria-label from 4.8).

#### 6.3.7 `tests/components/DeleteListBtn.test.tsx`

| Case | Implementation |
|---|---|
| Title in dialog | Click `getByRole("button", { name: "Remove from list" })` → the dialog text contains "Fight Club" in `<b>`. |
| Request | Click "Remove" → `fetch` called with `("/api/remove-from-list" /* after the fix */, objectContaining({ method: "DELETE", headers: objectContaining({ userId: "u1", movieId: "550" }) }))`. |
| Toasts | success → `toast.success("Fight Club was removed.", …)`. fail or reject → `toast.error("Something went wrong while removing.", …)`. |
| Refresh + close | `router.refresh` called and the dialog closed, for both outcomes. |
| In-flight | Deferred fetch → "Removing..." shown and the button disabled. |

#### 6.3.8 `tests/components/DeleteModal.test.tsx`

`<form action={fn}>` does nothing under React 18.2 in jsdom, so real submission is covered by E2E 6.5.7.

| Case | Implementation |
|---|---|
| Opens | Click "Delete my account" → `getByRole("dialog", { name: "Are you sure?" })`. |
| Input required | `getByLabelText(/To permamently delete/)` `toBeRequired()`. |
| Hidden id | `document.querySelector('input[type="hidden"][name="id"]')` has value `"u1"`. |
| Pending state | Render `DeleteModalBtn` alone with `vi.mocked(useFormStatus).mockReturnValue({ pending: true } as any)` → "Deleting..." shown and the button disabled. The default mock → "Delete", enabled. |

#### 6.3.9 `tests/components/DeleteResult.test.tsx`

`vi.useFakeTimers()`. Render, then `vi.runAllTimers()`.

| Case | Implementation |
|---|---|
| success / fail | `toast.success("Account deleted succesfully.", …)` / `toast.error("Failed to delete account.", …)`, each called once. |
| No toast | `it.each([undefined, "other"])` → neither toast is called. |
| Re-render | **fails [3.9]:** `rerender(<DeleteResult deleteAcc="success" />)` + `runAllTimers` → `toast.success` called only once. Today it's called twice. |

#### 6.3.10 `tests/components/FiltersForm.test.tsx`

Render `FiltersForm` with realistic children:
- `<input name="query" defaultValue="  Fury  " />`
- `<select name="language">` with options `""` and `"fr"`
- `<SelectYear />`
- `<IncludeAdult />`

`LangSelect` is async, so it's replaced by a plain select here.

| Case | Implementation |
|---|---|
| Movie / TV buttons | Click "Search movies" → `router.push` called with `"/search?query=Fury&btn=movie"`. "Search TV shows" → `btn=tv`. This relies on jsdom setting `SubmitEvent.submitter`, which jsdom ≥ 22 does. Verify early. |
| All filters | Select `fr` and `2014`, click the "Include adult" label → the pushed URL's params equal `{ query: "Fury", language: "fr", year: "2014", adult: "true", btn: "movie" }` (compare `Object.fromEntries(qp(url))`). |
| Empty selects omitted | Defaults → the URL has no `language` or `year` keys. |
| Pending state | The mocked `router.push` finishes synchronously, so `isPending` never shows. Cover the visual part in `SubmitBtn` (6.3.12) and the integrated behaviour in E2E (`__slow__` query, 6.5.3). |

#### 6.3.11 `tests/components/Navbar.test.tsx`

Logged in, the navbar renders `AuthBtn` twice (desktop + mobile), so use `getAll*`. Visibility is controlled by Tailwind classes, which jsdom doesn't apply, so assert on the classes.

| Case | Implementation |
|---|---|
| Logged out | `getAllByRole("link", { name: "Sign In" })[0]` has `href="/signin"`. No "Account menu" button. |
| Logged in | `getAllByRole("button", { name: "Account menu" })` has length 2. `getAllByAltText("Profile")`. |
| Dropdown toggle | Click the first avatar → its dropdown (`getAllByText("Logged in as:")[0].closest(".absolute")`) has class `block` and contains "Delete my account" and "Sign Out". Click again → `hidden`. |
| Click outside | Open, then `fireEvent.mouseDown(document.body)` → `hidden`. |
| Mobile toggle | Click "Toggle menu" → `#menu` has `hidden`, `#x` doesn't, and `#MobileNav` has `translate-y-[4rem]`. Click again → reverts to `-translate-y-[10rem]`. |
| Links | `getAllByRole("link", { name: "Manual Search" })` all have `href="/search"`. Same for "My list" → `/my-list` and "About" → `/about`. |

#### 6.3.12 Small components (`tests/components/small/*.test.tsx`)

| Component / case | Implementation |
|---|---|
| ListCard link | `getByRole("link", { name: "Fury" })` has `href="/search/movie/550"`. |
| ListCard rating | `rating: 0` → "Not rated". `rating: 7` → "7". |
| ListCard type | `type: "tv"` → "Type: Tv". |
| ListCard icons | `it.each([["Watching","lucide-eye"],["Completed","lucide-circle-check"],["Planning to watch","lucide-notebook-pen"]])` → `container.querySelector("svg." + cls)` is not null. Check the class names against lucide-react 0.359 once. |
| ListSortLink | `isActive` → `getByRole("button")` disabled, `queryByRole("link")` null. Inactive → the link has the given `href`. |
| ListTypeSelect | Options `["", "Planning to watch", "Completed", "Watching"]`. `user.selectOptions(select, "Watching")` → `setStatus` called with `"Watching"`. |
| RatingSelect | Options `""` + `"1"`…`"10"`. Selecting "7" → `setRating("7")`. |
| SelectYear | `vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-06-15"))` → option values after the placeholder are `2026…1888` (139 options), with `2026` first. |
| SubmitBtn | `name="btn"`, `value="tv"`, `type="submit"`. `pending` → "Generating..." shown and disabled. |
| PageBtn | `getByRole("button", { name: "3" }).closest("a")` has `href === buildSearchURL(fv, 3)`. `current` → disabled. |

#### 6.3.13 `tests/components/Pages.test.tsx`

`fv = { query: "Fury", language: "fr", year: "2014", adult: true, btn: "movie" }`. `numbers()` returns the buttons' accessible names, excluding Previous/Next, as numbers. `hrefOf(name)` returns `getByRole("button", { name }).closest("a")!.getAttribute("href")`.

| Case | Implementation |
|---|---|
| Page 1 of 50 | "Previous" disabled. `numbers()` → `[1,2,3,4,5,50]`. |
| Page 10 of 50 | `[6,7,8,9,10,11,12,13,14,50]`. Button "10" disabled and has class `bg-primary-text`. |
| **fails [B5]** last page | `page="3" totalPages={3}` → "Next" disabled and no number > 3. |
| **fails [B5]** page 2 of 3 | `queryByRole("button", { name: "4" })` is null. |
| 500 cap | `totalPages={800}` → `getByText(/Page:/).textContent` is `"Page:  1 / 500"` (normalise whitespace). The last number is 500. |
| Single page | `totalPages={1}` → both "Previous" and "Next" are disabled. |
| Filters kept | For every button, `Object.fromEntries(qp(href))` contains `fv` (as strings) plus `page` equal to that button's number. The same holds for the Previous/Next links (`page ± 1`). |

### 6.4 Server components (`components` project, `tests/server-components/`)

Technique: `render(await Component(props))`. Async children (e.g. `MovieCard` inside `SearchResults`) can't be rendered by React 18 on the client, so mock them with sync stubs. TMDB is mocked with `mockTmdb` (3.3) using the shared fixtures. `getSession` is the global mock. Set a user per test with `vi.mocked(getSession).mockResolvedValue(makeSession(u) as any)`.

#### 6.4.1 `SearchResults.test.tsx`

`vi.mock("@/Components/ui/MovieCard", () => ({ default: ({ movie }: any) => <div data-testid="card">{movie.id}</div> }))`. `getTitle` is `vi.fn(() => "T")` (or the real one after the 4.8 move).

| Case | Implementation |
|---|---|
| Endpoint choice | No query → `lastTmdbUrl(spy).pathname === "/3/discover/movie"`. With query → `/3/search/tv` for `btn: "tv"`. |
| `\|` join | `query: "the  dark knight"` → `searchParams.get("query") === "the\|dark\|knight"`. |
| Params | `{ adult: true, language: "fr", page: "2", year: "2014" }` → `include_adult=true`, `language=fr`, `page=2`, `year=2014`. No year → no `year` key. |
| Auth header | `spy.mock.lastCall[1].headers.Authorization === "Bearer test-tmdb-token"`. |
| **fails [B6]** | `query: "Tom & Jerry"` → `get("query") === "Tom\|&\|Jerry"`, and there is no stray `"\|Jerry"` key. |
| Empty | `{ results: [], total_pages: 0, total_results: 0 }` → the "No results with these filters were found." text, and no cards. |
| Error | 500 → `await expect(SearchResults(props)).rejects.toThrow("Failed to fetch search results (Status: 500)")`. |
| **fails [B7]** (after the move) | Real `getTitle` with `btn: "tv"` and no query → the heading does not equal "Trending movies". |

#### 6.4.2 `Details.test.tsx`

`vi.mock("@/Components/ui/AddToListBtn", () => ({ default: vi.fn(() => null) }))`.

| Case | Implementation |
|---|---|
| Movie fields | Fixture `runtime: 139, budget: 63_000_000, revenue: 100_853_753` → "Duration:" "139 min.", "Budget:" "$63.0M", "Revenue:" "$100.9M". |
| TV fields | The TV fixture → "Seasons:", "First air date:", "Show type:". There is no "Budget". |
| Title/name | Movie `h1` = `title`. TV `h1` = `name` (the TV fixture has no `title`). |
| No poster | `poster_path: null, backdrop_path: null` → "No poster.". |
| Genres | Each genre name rendered. |
| Rating | `vote_average: 8.438, vote_count: 27000` → "8.4 / 27000". |
| Watch link | `getByRole("link", { name: "Where to watch?" })` has `href="https://www.themoviedb.org/movie/550/watch"`. |
| AddToListBtn props | `vi.mocked(AddToListBtn)` called with `objectContaining({ user: session.user, movieId: 550, title: "Fight Club", type: "movie", fullSize: true })`. |

#### 6.4.3 `Trailer.test.tsx`

| Case | Implementation |
|---|---|
| First trailer | Results `[Teaser key a, Trailer key b, Trailer key c]` → `getByTitle("Trailer")` has `src="https://www.youtube.com/embed/b"`. |
| Fallback | No `type: "Trailer"` → "No trailer.". |
| Site check | `test.todo("ignores non-YouTube trailers")` until decided. |

#### 6.4.4 `Gallery.test.tsx`

| Case | Implementation |
|---|---|
| Max 9 | 12 backdrops → `getAllByAltText("Gallery image")` has length 9 (the dialogs are closed). |
| Empty | "No images were found.". |
| Dialog | `user.click(getAllByRole("button")[0])` → the dialog title is "`{vote_count}` people rated this picture: `{avg.toFixed(1)}`", and there's a larger image with `src` containing `/w1280`. |

#### 6.4.5 `Reviews.test.tsx`

| Case | Implementation |
|---|---|
| Max 10 | 12 reviews → 10 author names rendered. |
| Empty | "No reviews were found.". |
| Avatar | `avatar_path: null` → no `img` with that author's alt, and `svg.lucide-circle-user` present. Otherwise `getByAltText(author)`. |
| Sanitising | Content `<p>ok</p><script>alert(1)</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)">x</a>` → "ok" visible. `container.querySelector("script")` is null. `img` has no `onerror` attribute. The `a` has no `href` starting with `javascript:`. |
| Long content | A 900-char review → "Hover to reveal". An 860-char review → absent (boundary). |

#### 6.4.6 `MovieCard.test.tsx`

`AddToListBtn` stays real (client component).

| Case | Implementation |
|---|---|
| Link | `type: "tv", id: 7` → a link with `href="/search/tv/7"` (the one containing the title). |
| NoImage | Both paths null → "No Image". |
| Title fallback | `title: undefined, name: "Show"` → `h1` "Show". |
| Rating | `vote_average: 7.25` → "7.3 / 10" (whatever `toFixed(1)` returns; pin the exact output). |

#### 6.4.7 `LangSelect.test.tsx`

| Case | Implementation |
|---|---|
| Options | A 3-language fixture → 4 `option`s. The first is "Choose language" with value `""`, and the values are the `iso_639_1` codes. |
| Error | 500 → `rejects.toThrow("Failed to fetch languages")`. |

#### 6.4.8 `detail-metadata.test.tsx`

Import `generateMetadata` from `@/app/search/movie/[id]/page` and `@/app/search/tv/[id]/page`.

| Case | Implementation |
|---|---|
| Titles | `{ params: { id: 550 } }` → `"Fight Club \| CineRadar"`. The TV fixture → `"Game of Thrones \| CineRadar"`. Assert the fetched pathname is `/3/movie/550` or `/3/tv/1399`. |
| Error | 500 → rejects. |

#### 6.4.9 `HomePage.test.tsx`

`vi.mock("@/Components/RecaptchaWrapper", () => ({ default: ({ children }: any) => <div data-testid="recaptcha-wrapper">{children}</div> }))`. Render `Home({ searchParams: {} as any })`.

| Case | Implementation |
|---|---|
| Enabled + reCAPTCHA | Stub `AI_CHAT_ENABLED=true` and both keys → `getByTestId("recaptcha-wrapper")` contains the chat heading "Chat with CineRadarAI". |
| Enabled, no reCAPTCHA | Keys `""` → no wrapper, the chat is rendered, and `getByPlaceholderText(...)` is enabled. |
| Disabled | `AI_CHAT_ENABLED=""` → `getByText(/OUT OF ORDER/)` and `getByText(/no longer available/)`. **fails [B9]:** `container.querySelector("[inert]")` contains the chat input. |

### 6.5 End-to-end (Playwright)

All specs import `{ test, expect }` from `tests/e2e/fixtures.ts`.

#### 6.5.1 `navigation.spec.ts`

| Case | Implementation |
|---|---|
| Navbar links | From `/`, click `nav` links: "Manual Search" → `toHaveURL(/\/search$/)`, "About" → `/about`, "Sign In" → `/signin`, the logo "CineRadar" → `/`. Logged out, "My list" → `/signin…` (see 6.5.5). Logged in (`loginAs`) → `/my-list`. |
| About | `getByRole("heading", { name: "About" })`, "Data source", "Legal notice". |
| 404 | `goto("/definitely-missing")` → heading "Not found". Click "Return Home" → `toHaveURL(BASE_URL + "/")`. |
| Mobile menu | `test.use({ viewport: { width: 390, height: 844 } })`. `#MobileNav` has class `/-translate-y-\[10rem\]/`. Click "Toggle menu" → class `/ translate-y-\[4rem\]/`, and `#MobileNav >> text=About` `toBeInViewport()`. Click again → back. |

#### 6.5.2 `chat.spec.ts` (default variant, chat enabled)

| Case | Implementation |
|---|---|
| Full turn | `stubAssistant(page, () => ({ events: answer("i1", "Here you go:\n1. [Fury](/search?query=Fury&btn=movie&year=2014) (2014) — tanks.") }))`. Type into the placeholder "Suggest me movies…", click "Submit" → `getByRole("listitem")` contains "Fury". |
| Loader + disabled input | Stub with `hold` (a promise the test resolves) → `getByRole("status")` visible, input `toBeDisabled()`, button "Generating...". Resolve → the answer appears and the input is enabled. |
| Recommendation link | Click `getByRole("link", { name: "Fury" })` → `toHaveURL(/\/search\?query=Fury&btn=movie&year=2014/)`. `getByPlaceholder("Type keywords...")` `toHaveValue("Fury")`. The year select `toHaveValue("2014")`. |
| Follow-up id | Two turns. `calls[0]` has no `previousInteractionId`, `calls[1].previousInteractionId === "i1"`. |
| Error state | `stubAssistant(() => ({ status: 500 }))` → "Unfortunately an error occurred. Try again later.". |
| (optional) live streaming | `page.route("**/api/assistant", r => r.continue({ url: "http://127.0.0.1:4010/__assistant/slow" }))`, with the mock server writing NDJSON lines 300 ms apart → a partial text is visible before the final one. If Chromium buffers the proxied body, drop this; 6.3.1 already covers it. |

#### 6.5.2b `variants/chat-disabled.spec.ts` and `variants/recaptcha.spec.ts`

| Case | Implementation |
|---|---|
| Overlay | `getByText(/OUT OF ORDER/)` and `getByText(/no longer available/)` visible. |
| Input unusable | **fails [B9]:** `getByPlaceholder(...).focus()`, then `page.keyboard.type("hello")` → the input `toHaveValue("")`. Also `expect(page.locator("[inert]")).toHaveCount(1)`. |
| reCAPTCHA failure | `page.route("https://www.google.com/recaptcha/**", r => r.fulfill({ contentType: "text/javascript", body: "window.grecaptcha={ready:c=>c(),execute:()=>Promise.resolve('e2e-token')};" }))`. `page.route("**/api/recaptcha", r => r.fulfill({ json: { success: false } }))`. Stub `/api/assistant` and count calls. Submit → "Recaptcha failed to verify!" visible, then hidden within about 4 s. The assistant call count is 0. The legal notice "protected by reCAPTCHA" is visible. |
| reCAPTCHA success | `/api/recaptcha` → `{ success: true, score: 0.9 }` → the assistant is called once, and the verify request body is `{ recaptchaToken: "e2e-token" }`. |

#### 6.5.3 `search.spec.ts`

| Case | Implementation |
|---|---|
| Trending | `goto("/search")` → heading "Trending movies", 20 cards (D24) (`locator('a[href^="/search/movie/"]')`), and a card titled "Trending movie p1 #1". |
| Full filter search | Fill "Type keywords..." with "Fury", `selectOption` language `"fr"` and year `"2014"`, click the "Include adult" label, click "Search movies" → `toHaveURL(/query=Fury&language=fr&year=2014&adult=true&btn=movie/)`. Heading "Results for: Fury in FR language, 2014 year, including adult.". `reload()` → the inputs keep their values and the checkbox is `toBeChecked()`. |
| TV | Same query + "Search TV shows" → cards link to `/search/tv/`, titled "Fury tv p1 #1". |
| Pagination | Query "Fury". Click "Next" → `page=2` and "Fury movie p2 #1". Click button "4" → `page=4`. "Previous" → `page=3`. |
| No results | Query `__empty__` → "No results with these filters were found. Try something else.". |
| TMDB failure | Query `__error__` → "An unexpected error occured." (the error.tsx text). In `next dev` the error overlay may also appear, but the assertion still works. |
| Skeleton (optional) | Query `__slow__` → `getByTestId("search-results-skeleton")` visible, then results appear. The submit buttons show "Generating..." during the transition. |
| Encoding (B6, E2E view) | **fails [B6]:** search "Tom & Jerry" → `GET /__requests` on the mock contains an entry whose parsed `query` equals `"Tom\|&\|Jerry"`. |

#### 6.5.4 `details.spec.ts`

| Case | Implementation |
|---|---|
| Movie page | `goto("/search/movie/550")` → `toHaveTitle("Fight Club \| CineRadar")`, "Duration:", "Budget:". `locator('iframe[title="Trailer"]')` has `src` containing `/embed/`. |
| Gallery dialog | Click `getByAltText("Gallery image").first()` → `getByRole("dialog")` contains "people rated this picture". Escape closes it. |
| Reviews | 10 review blocks. At least one "Hover to reveal". `page.on("dialog")` never fires (the sanitised payloads don't run). |
| TV page | `/search/tv/1399` → "Seasons:", "Show type:", title "Game of Thrones \| CineRadar". |
| Anchors | Click "Gallery" → `toHaveURL(/#gallery$/)` and `locator("#gallery")` `toBeInViewport()`. The same for Trailer and Reviews. |
| Unknown id | `/search/movie/999999` → the error page. |

#### 6.5.5 `auth.spec.ts`

| Case | Implementation |
|---|---|
| Protected redirect | Logged out, `goto("/my-list")` → the URL pathname is `/signin`. `decodeURIComponent(url)` contains `callbackUrl=` and `/my-list` (the middleware → `/api/auth/signin` → `pages.signIn` chain). |
| Sign-in page | Buttons "Sign in with Google" (`value="google"`) and "Sign in with Github" (`value="github"`) are visible. GitHub: `page.route("https://github.com/**", r => r.abort())`, then `waitForRequest(/github\.com\/login\/oauth\/authorize/)` after clicking. The request URL has `client_id=e2e-github-id`. Don't click Google: the OIDC discovery makes a server-side call to accounts.google.com. |
| Logged-in navbar | `loginAs()`, `goto("/")` → the first visible "Account menu". Click it → "Delete my account" and "Sign Out" are visible. |
| Sign out | Click "Sign Out" → `getByRole("link", { name: "Sign In" }).first()` is visible, and `sessionCount(db, user.id) === 0`. |
| (B10) | `test.fixme`: callbackUrl isn't honoured after login. Needs OAuth to test end-to-end, so this one is documentation only. |

#### 6.5.6 `my-list.spec.ts`

Seed lists directly via `seedList` wherever the UI path isn't what's under test.

| Case | Implementation |
|---|---|
| Add from details | `loginAs()`, `/search/movie/550`, click "Add to list". In the dialog, `getByLabel("Status:").selectOption("Completed")` and `getByLabel("Rating (optional):").selectOption("8")`, then click the dialog's "Add to list" → toast "Fight Club was added to the list.". `getMovies` has `{ movieId: 550, rating: 8 }`. |
| List shows item | `/my-list` → link "Fight Club" (`href="/search/movie/550"`), "8", "Type: Movie", "Completed". The header shows "`{user.name}` movie and TV show list.". |
| Edit | Click "Edit list entry", select "Watching" and "5", click "Edit" → toast "Fight Club was updated.". The row shows "Watching" and "5" without a manual reload. |
| Remove | Click "Remove from list", then "Remove" → toast "Fight Club was removed.". "Your list is empty." appears. |
| Sort / filter | Seed 4 items (movie/tv × statuses × ratings 0/3/7/10). Click "Ascending" → `toHaveURL(/rating=asc/)`, the item link texts are in ascending rating order, and `getByRole("button", { name: "Ascending" })` is disabled. "TV shows" → only TV items and `type=tv`. "Watching" → `status=watching`. |
| Count | "Length: N" matches the visible item count after each filter. |
| Empty | A new user → "Your list is empty." and "Length: 0". |
| Refresh | With filters applied, click "Refresh list" → `toHaveURL(BASE_URL + "/my-list")`, and all items are shown. |
| Logged out add | `/search/movie/550` without a login, try to add → toast "You need to be logged in!". |

#### 6.5.6b `security.spec.ts` (B1/B2, real HTTP)

| Case | Implementation |
|---|---|
| **fails [B1]** anonymous PUT | `seedUser()` victim with a seeded list. `request.put("/api/add-to-list", { data: { userId: victim.id, movieId: "1", title: "x", image: "", status: "Completed", rating: "", type: "movie" } })` with no cookie → the victim's `getMovies` is unchanged. |
| **fails [B1]** cross-user PUT | `loginAs()` attacker, then `page.request.put(...)` (shares the context cookie) with the victim's id → the victim is unchanged. |
| **fails [B2]** DELETE | `request.delete("/api/remove-from-list", { headers: { userId: victim.id, movieId: "1" } })`, anonymous and as the attacker → the victim's entry is still present. |

#### 6.5.7 `account-deletion.spec.ts`

`openDelete(page)`: click "Account menu", then "Delete my account".

| Case | Implementation |
|---|---|
| Wrong text | Type "delete" and click "Delete" → `toHaveURL(/\/\?deleteAcc=fail/)`, toast "Failed to delete account.", `userExists(db, user.id)` is true. |
| Correct text | Seed a list, type "Delete account", click "Delete" → `/?deleteAcc=success`, toast "Account deleted succesfully.". `userExists` is false and `getMovies` is undefined. The navbar shows "Sign In". |
| **fails [B3]** tampering | Seed victim B. Log in as A. `page.route` the server-action POST to `/` and replace A's id with B's id in the body (D22: editing the hidden input doesn't work, because React restores it). Submit "Delete account" → `userExists(db, B.id)` is still true. |

---

## 7. Order of work

1. ✅ **Infrastructure** (done, see "Status" at the top):
   - Dependencies.
   - Configs (3.1, 4.2) and setup files (3.2).
   - Helpers (3.3).
   - Repo changes (4.8).
   - A smoke test per project: one unit, one integration (seed + read), one component, and one E2E (`/about` loads, `loginAs` shows the avatar).
   - CI (5).
2. ✅ **6.1 + 6.2** (done). This includes the B1–B4 and B8 `test.fails` cases, which puts the security findings under test on day one.
3. ✅ **6.3.1, 6.3.2, 6.3.5, 6.3.10, 6.3.13** (done): chat, markdown safety, add-to-list, filters, pagination. This includes B5 ×2 under `test.fails`.
4. ✅ **6.5.2, 6.5.3, 6.5.5, 6.5.6, 6.5.6b, 6.5.7**, then the two variant specs (done). This includes B1 ×2, B2 ×2, B3, B6 and B9 under `test.fail`.
5. Everything else (6.3 remainder, 6.4, 6.5.1, 6.5.4).
6. Fix the bugs one by one. Each fix turns its `test.fails` into an unexpected pass. Flip it to a normal `test` in the same PR.
