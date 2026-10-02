# A: Regroup `src/` into feature modules

Status: proposed · Depends on: nothing · Unblocks: [B](B-tmdb-module.md), [C](C-my-list-module.md)

## Goal

Group code by feature instead of by code type. Today one feature is spread across many folders. For example, the chat assistant lives in about 15 files across `Components/`, `Components/ui/`, `hooks/`, `lib/`, `lib/llm/`, `types/` and `app/`. After this change, everything a feature needs sits in one folder: components, hooks, server code, types, skeletons and tests.

This is a **move-only** refactor. Behaviour must not change. Problems you find while moving go into B, C or a follow-up, not into the move commits.

## Target structure

```
src/
  app/                    Next routes only: page/layout/loading/route files that compose module exports
  middleware.ts           must stay here (Next convention)

  infra/                  talks to the outside world, used by many modules
    db/                   index.ts (drizzle client), schema/ (users.ts, lists.ts; see "Schema location")
    auth/                 auth.ts (NextAuth config), session.ts (getSession), next-auth.d.ts
    recaptcha/            isRecaptchaEnabled, RecaptchaWrapper, useRecaptchaCheck
    config/               feature flags (optional now; see D)
    tmdb/                 added by B

  shared/                 generic code with no feature knowledge
    ui/                   Modal.tsx, Skeleton.tsx, Toaster.tsx (was ui/sonner.tsx)
    lib/                  cn.ts, shuffle.ts

  modules/
    search/               Filters, FiltersForm, SearchResults, MovieCard, NoImage, Pages, PageBtn,
                          LangSelect, SelectYear, IncludeAdult, SubmitBtn, filter schema (validation.ts),
                          searchTitle, buildSearchURL, search skeletons, search types
    title/                Details, Gallery, Reviews, Trailer, formatCurrency, details skeletons
    my-list/              MyListItems, ListCard, AddToListBtn, EditListBtn, DeleteListBtn, ListSortBtn,
                          ListSortLink, ListTypeSelect, RatingSelect, myList.ts, list skeletons
    chat/                 ChatAssistant, AssistantMessage, ChatSubmitBtn, ThinkingLoader, useChat,
                          chatConfig, chatLimits, loaderWords, llm/llmService, protocol types
    account/              actions.ts (SignOut, DeleteUser), AuthBtn, DeleteModal, DeleteModalBtn, DeleteResult
    layout/               Navbar, Footer

tests/                    cross-cutting test infra only
  setup/  helpers/  fixtures/  e2e/
```

### Layout inside a module

Keep it flat. Add a subfolder only once a module has more than about 8 files of one kind.

```
modules/my-list/
  index.ts                public surface, safe to import anywhere (components, types, pure functions)
  server.ts               public surface for server-only code (DB, TMDB, session); optional
  actions.ts              "use server" actions, imported directly; optional
  components/             ListCard.tsx, ListCard.test.tsx, ...
  skeletons/              ListRowsSkeleton.tsx, ...
  myList.ts               logic
  myList.test.ts          unit test (node)
  myList.int.test.ts      integration test (real libsql)
```

### Where the uncertain files go

| File | Goes to | Why |
|---|---|---|
| `lib/utils.ts` | split: `cn` → `shared/lib/cn.ts`, `buildSearchURL` → `modules/search`, `formatCurrency` → `modules/title` | It mixes three owners. Every importer of `cn` currently pulls in the search zod schema |
| `Components/ui/MovieCard.tsx` | `modules/search` | It renders search results. It imports `AddToListBtn` from `@/modules/my-list` |
| `Components/RecaptchaWrapper.tsx`, `hooks/useRecaptchaCheck.ts`, `lib/recaptcha.ts` | `infra/recaptcha` | They wrap an external service. Chat is the only consumer today |
| `lib/loaderWords.ts` | `LOADER_WORDS` → `modules/chat`, `shuffle` → `shared/lib/shuffle.ts` | |
| `types/chatStream.ts`, `types/message.ts` | `modules/chat/protocol.ts` (exported types) | See "Ambient types" below |
| `types/search.ts`, `types/language.ts` | `modules/search/types.ts`, later replaced by B's TMDB types | |
| `types/next-auth.d.ts` | `infra/auth/next-auth.d.ts` | Module augmentation; stays ambient |
| `Components/ui/sonner.tsx` | `shared/ui/Toaster.tsx` | |
| `Components/ui/NoImage.tsx` | `modules/search` | Only MovieCard uses it |

## Rules

1. **`app/` contains only Next route files.** Pages import from modules and compose them. Logic does not live in `app/`.
2. **Code outside a module imports only the module's public entries:** `@/modules/<m>` (index), `@/modules/<m>/server`, or `@/modules/<m>/actions`. Deep imports such as `@/modules/my-list/components/ListCard` are forbidden.
3. **Code inside a module uses relative imports** for its own files, and `@/` aliases for `infra/`, `shared/` and other modules' public entries.
4. **Dependencies flow one way:** `app → modules → infra/shared`. `infra/` and `shared/` never import from `modules/`. `shared/` never imports from `infra/`.
5. **`index.ts` must be safe for every importer.** It must not re-export anything that imports the DB, `next-auth`, `next/headers` or Gemini. Those go in `server.ts`. Client components and the edge-runtime home page import from `index.ts`.
6. **Tests sit next to the code they test.** The suffix chooses the vitest project:
   - `*.test.ts`: unit (node)
   - `*.int.test.ts`: integration (node + DB)
   - `*.test.tsx`: components (jsdom)
7. **`tests/` keeps only cross-cutting test infrastructure:** setup files, generic helpers, fixtures and e2e. Helpers for a single feature move into that module, for example `tests/helpers/listForm.tsx` → `modules/my-list/testing/listForm.tsx` and `tests/helpers/stream.ts` → `modules/chat/testing/stream.ts`.
8. **Folder names are lowercase.**

## How to do it

Do it as a series of small commits. Each commit must pass the full check described in "Done when". Use `git mv` so history follows the files (`git log --follow`).

### Step 0: Make the tooling accept both layouts

Do this before moving anything, so every later commit is a pure move.

- **`vitest.config.mts`:** add suffix globs next to the existing folder globs.
  ```ts
  import { configDefaults } from "vitest/config";
  // unit
  include: ["tests/unit/**/*.test.ts", "src/**/*.test.ts"],
  exclude: [...configDefaults.exclude, "**/*.int.test.ts"],
  // integration
  include: ["tests/integration/**/*.test.ts", "src/**/*.int.test.ts"],
  // components
  include: ["tests/components/**/*.test.tsx", "tests/server-components/**/*.test.tsx", "src/**/*.test.tsx"],
  ```
  Also add an alias `"@test": "./tests"` so colocated tests can import `@test/helpers/db` instead of `../../../../tests/helpers/db`.
- **Root `tsconfig.json`:** add `"src/**/*.test.ts"`, `"src/**/*.test.tsx"` and `"src/**/testing/**"` to `exclude`. `next build` type-checks everything the root tsconfig includes, and test files must not be part of the app build.
- **`tests/tsconfig.json`:** it already includes `../src/**/*`. Add `paths` for `@test/*`. When you add `paths` here it **replaces** the root `paths`, so repeat `"@/*": ["../src/*"]`.
- **`.eslintrc.json`:** add the module boundary rules as `warn` for now (see "ESLint boundaries" below).

### Step 1: `shared/` and `infra/`

Move `cn`, `Modal`, `Skeleton`, `sonner`, `db/`, `auth.ts`, `lib/session.ts`, recaptcha and `types/next-auth.d.ts`. Then update everything that points at the old paths:

- `drizzle.config.ts` and `drizzle.test.config.ts`: `schema: "./src/infra/db/schema/*"`.
- `src/middleware.ts`: `export { auth as middleware } from "@/infra/auth"` (or the equivalent).
- `app/api/auth/[...nextauth]/route.ts`.
- `tests/setup/shared.ts`: `vi.mock("@/lib/session")` → the new path.
- `vi.mock("@/auth")` and `vi.mock("@/db")` in tests.
- `tests/e2e/helpers/db.ts` and `tests/e2e/fixtures.ts`: they use **relative** paths `../../../src/db/schema/...`.

### Step 2: One module per commit

Suggested order, smallest blast radius first:

1. **`layout`**
2. **`account`**:
   - Move `app/actions.ts` to `modules/account/actions.ts`.
   - Update `vi.mock("@/app/actions")` in `tests/setup/components.tsx`.
3. **`title`**
4. **`search`**:
   - MovieCard now imports `AddToListBtn` from `@/modules/my-list`.
   - Until my-list is moved, it imports from the old path.
5. **`my-list`**
6. **`chat`**:
   - Move the ESLint Gemini override from `src/lib/llm/**` to `src/modules/chat/llm/**` and update its message.
   - Update the paths in `AI_CHAT_BACKEND_PLAN.md`, or add a note that its paths refer to commit `2db64b8`.

For each module:
1. `git mv` the source files, their skeletons and their tests. Rename tests to the suffix convention: `tests/unit/lib/myList.test.ts` → `modules/my-list/myList.test.ts`, `tests/integration/lib/myList.test.ts` → `modules/my-list/myList.int.test.ts`.
2. Create `index.ts` (and `server.ts` if needed) with the public surface.
3. Rewrite imports. Use a search/replace on `@/Components/...` specifiers, or VS Code's "update imports on file move". Then run `tsc` to catch the rest.
4. Update `vi.mock("@/Components/...")` targets in tests. They must mock the specifier that **the code under test** imports. For example, the Details test currently mocks `@/Components/ui/AddToListBtn`. If Details imports from `@/modules/my-list`, the test must mock `@/modules/my-list`, typically with a partial mock.
5. Convert the module's ambient global types into exported types and add the imports (see below).

### Step 3: Clean up

- Delete the empty `Components/`, `hooks/`, `lib/` and `types/` folders, and the old folder globs in vitest (`tests/unit`, `tests/integration`, `tests/components`, `tests/server-components` should now be empty).
- Change the ESLint boundary rules from `warn` to `error`.
- **Coverage excludes:** replace `src/types/**` and `src/Components/skeletons/**` with `src/**/skeletons/**`, `src/**/*.test.*` and `src/**/testing/**`.
- Remove the dead tailwind `content` globs (`./pages`, `./components`, `./app`).
- Update the README if it describes the folder layout.

## ESLint boundaries

Use the built-in `no-restricted-imports` with `patterns`. Gitignore-style negation lets the public entries through:

```jsonc
{
  "rules": {
    "no-restricted-imports": ["error", {
      "paths": [{ "name": "@google/genai", "message": "Only src/modules/chat/llm/ may talk to Gemini, use llmService instead." }],
      "patterns": [{
        "group": ["@/modules/*/*", "!@/modules/*/server", "!@/modules/*/actions"],
        "message": "Import a module through its public entry: @/modules/<m>, /server or /actions. Inside a module, use relative imports."
      }]
    }]
  },
  "overrides": [
    {
      "files": ["src/infra/**", "src/shared/**"],
      "rules": { "no-restricted-imports": ["error", {
        "paths": [{ "name": "@google/genai", "message": "..." }],
        "patterns": [{ "group": ["@/modules/*"], "message": "infra/ and shared/ must not depend on feature modules." }]
      }]}
    },
    {
      "files": ["src/modules/chat/llm/**"],
      "rules": { "no-restricted-imports": ["error", {
        "patterns": [{ "group": ["@/modules/*/*", "!@/modules/*/server", "!@/modules/*/actions"] }]
      }]}
    }
  ]
}
```

An override **replaces** the rule's options; it does not merge them. That is why every override repeats the parts it still needs. The current config switches the rule fully `off` inside `llm/`, which would also switch off the boundary check there. Test the config on purpose: add a forbidden import, run `npm run lint`, and see it fail.

## Ambient types

The files in `src/types/*.ts` have no `import` or `export`, so TypeScript treats them as global scripts. Nothing imports them, which means you can't find who uses a type and moving the file tells you nothing. While moving each module, add `export` to the types it owns and add imports at each use site. The known use sites are:

- `ChatStreamEvent`, `StoppedTurn`, `ChatRequest`, `Tmessage`: `useChat.ts`, `llmService.ts`, `app/api/assistant/route.ts`, `tests/e2e/helpers/chat.ts`, chat tests.
- `Results`, `FetchedData`, `fetchMoviesProps`, `Language`: `SearchResults.tsx`, `LangSelect.tsx`, search tests.

`next-auth.d.ts` is different: it is a module augmentation (`declare module "next-auth"`) and must stay ambient.

## Schema location

**Recommendation: keep all drizzle tables in `infra/db/schema/` for A.** Reasons:
- The drizzle-kit configs, the NextAuth `DrizzleAdapter`, the FK `lists.userId → users.id` and the e2e helpers all span modules.
- Moving the tables is not a pure move.

C moves `lists.ts` into `modules/my-list`. It has a concrete reason: the table's column type should be the module's `ListEntry` type, and `infra/` must not import from modules. At that point, drizzle `schema` becomes an array: `["./src/infra/db/schema/*", "./src/modules/*/schema.ts"]`.

## Watch out for

- **Edge runtime.** `app/page.tsx` and `app/api/assistant/route.ts` run on `runtime = "edge"`. `page.tsx` imports chat, recaptcha and account (`DeleteResult`). If `modules/account/index.ts` re-exports `actions.ts` (DB, next-auth), the edge bundle pulls in libsql. Keep `index.ts` free of server-only imports and run `next build` after each module.
- **Client components importing barrels.** `Navbar` is a client component. If it imports `@/modules/account` and that `index.ts` re-exports anything server-only, the build fails or bundles server code into the client. The same rule applies: server-only code goes in `server.ts` or `actions.ts`.
- **`"use client"` directives** stay at the top of the moved files. `index.ts` never gets one. `AuthBtn` and `DeleteModal` use hooks without `"use client"`. They only work because a client parent imports them. Moving them doesn't change that, but don't make them importable from a server component.
- **`vi.mock` specifiers must match what the code under test imports**, as described in step 2.4. A wrong mock path doesn't fail. It silently stops mocking, and the test may then hit the real DB or `fetch`.
- **Global mocks in setup files** hardcode `@/lib/session` and `@/app/actions`. Missing one of these breaks every test in the project, which at least makes it obvious.
- **The integration DB is a file per worker**, not `:memory:`. See the F4 comment in `tests/setup/integration.ts`. `.int.test.ts` files must not run in the unit project, so check the unit project's `exclude`.
- **`next lint` lints `src/`,** so colocated tests get linted with the Next rules. Fix or disable per file, as `tests/setup/components.tsx` already does.
- **No behaviour changes.** Leave everything that B, C, D or E would fix as it is: duplicated TMDB fetch code, Add/Edit duplication, the misplaced `"use server"` directives, and so on. Mixing them into the moves makes a failing commit hard to bisect.
- **Docs drift.** `AI_CHAT_BACKEND_PLAN.md` cites `src/lib/llm/llmService.ts`, `src/lib/chatConfig.ts`, `src/types/chatStream.ts` and others, and the ESLint error message names the llm path.

## Done when

Run this after every commit:

```
npm run lint && npx tsc --noEmit && npm run typecheck:tests && npm run test:run && npm run build
```

When the chat module and `infra/` are finished, also run:

```
npm run test:e2e && npm run test:e2e:variants
```

At the end of A:
- `src/Components`, `src/hooks`, `src/lib` and `src/types` no longer exist.
- `tests/unit`, `tests/integration`, `tests/components` and `tests/server-components` no longer exist.
- The ESLint boundary rules are at `error`, and a deliberately forbidden import fails lint.
- Coverage numbers are the same as before the refactor.

## Open decisions

- Module name for the details pages: `title` (the TMDB concept, covering movies and TV) or `details`. This doc uses `title`.
- Whether `layout` is its own module or `Navbar`/`Footer` go to `shared/`. They know about account (`AuthBtn`), so a module fits better.
- Whether `tests/` is renamed (for example `test-support/`) once it only holds infrastructure. Not needed.
