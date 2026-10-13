# Plan: change the list from the chat, and keep the chat for the session

## Goal

Users can change their list from the chat, e.g. "add the second one to my
watchlist" or "mark Dune as completed". The chat shows the result right away
("Added ✓", with Undo), and the change shows in `/my-list`.

Signed-out users don't hit a dead end. The chat shows a sign-in card for the
title they asked about. After signing in they come back to the same chat, and
the title is saved.

To make that work, and because losing the chat on every refresh is bad on its
own, the chat is kept for the browser-tab session: it survives refreshes,
navigating to other pages and the OAuth round trip.

The feature is done when:

- the chat survives a refresh and a visit to another page, and "New chat" and
  signing out clear it
- adding a title and changing its status work from the chat and show in
  `/my-list`
- a status change keeps the user's rating
- signed-out users get a sign-in card, and after signing in the title is saved
  without asking again
- a conversation Gemini no longer has shows a clear notice instead of a
  generic error

## How to work on this plan

The work is split into **7 phases**, run **one after another**. Each phase is
picked up by a different agent, which starts with no context except this file
and the repo.

1. **Before you start:** read the whole plan, then every entry in the
   [Progress log](#progress-log). If a log entry contradicts the plan, **the
   log wins**: it records what actually happened. Check that the previous
   phase is marked `done`. If it isn't, finish it or stop and report.
2. **During the phase:** do only your phase's scope. If you find a problem
   that belongs to a later phase, don't fix it. Write it in the log.
3. **If the plan is wrong** (an API behaves differently, a test can't be
   written as described, a better design is needed), choose the smallest
   change that keeps the design's intent. Write it in the log under
   "Deviations".
4. **Before you finish:**
   - Run every check in your phase's "Done when". All tests must be green.
   - Add your log entry using the template.
   - Commit, with the log entry in the phase's last commit.

   If a check fails or couldn't be run, mark the phase `blocked` or
   `done with gaps` and paste the relevant output. Never report a check as
   passing if it wasn't run.
5. **Commits:**
   - Use a single conventional-commit title line, like the history (e.g.
     `feat(chat): keep the chat for the session`). No body, no co-author
     trailer.
   - Stage only the files you changed (`git add <paths>`), never
     `git add -A`: the working tree can hold the user's unrelated changes.
6. **Each phase leaves the app working.** A server change the client doesn't
   render yet must not break the chat. `useChat` ignores event types it
   doesn't know, so new events are safe before their UI exists.
7. **Match the surrounding code.** Comments are short, lowercase and explain
   *why*. Tools use `zod/v4`, API routes and `my-list` use `zod` (v3). Client
   components don't import zod (see the note in `my-list/entryInput.ts`).

| Phase | Scope | Depends on |
|---|---|---|
| 1 | Chat persistence in `sessionStorage` (client only) | none |
| 2 | Expired conversations: a distinct server error and a client notice | 1 |
| 3 | List service, store fix and the `save_to_list` tool (server) | 2 |
| 4 | Prompt, sign-in state, tool choice, list-change notes (server) | 3 |
| 5 | Chat UI: saved rows with Undo, card list state, simple sign-in card | 4 |
| 6 | Sign-in round trip: provider buttons, pending saves, resume save | 5 |
| 7 | E2E, manual checks with a real key, cleanup | 6 |

## Decisions

| Topic | Decision |
|---|---|
| Where the chat is kept | `sessionStorage`, one versioned key (`cineradar.chat.v1`). It's per tab, survives refreshes, navigation and the OAuth redirect, and is cleared when the tab closes. No DB. `localStorage` was rejected: it's shared across tabs (they'd overwrite each other), never expires on its own, and would show the last person's chat on a shared computer. |
| How long it's kept | Until the tab closes, "New chat", sign-out or account deletion, and at most **20 hours** after the last save. Gemini keeps interactions for 1 day on the free tier (55 days on paid), so a saved chat expires before its interaction does. |
| What's saved | `messages`, `interactionId`, `stoppedTurns`, `listChanges` and (phase 6) `pendingSaves`, plus `version` and `savedAt`. Not `status` and not `streamingParts`. |
| Leaving mid-answer | Treated like pressing Stop: the partial answer is saved as a stopped message and a stopped turn, using the logic `stop()` already has. |
| Expired conversation | The route returns `409 { error: "conversation_expired" }`. The client keeps the messages, shows a notice, and the next message starts a fresh conversation. |
| Confirm or save directly | **Save directly**, then show "Added ✓" with **Undo**. Pausing in `requires_action` for a click doesn't fit a single streaming edge request (see phase 3 notes). Saving is low-risk and Undo reverses it. |
| Tool | One tool, **`save_to_list({ type, id, title, status? })`**, which adds a title or changes its status. It's named `save_to_list`, not `add_to_list` as in the ticket, because it also changes statuses. |
| Removing titles | **Out of scope.** It's destructive (it loses the rating), and Undo covers removing a title that was just added. |
| `title` argument | Added beyond the ticket's `type, id, status`. The server compares it with TMDB's title, like `show_recommendations`, so a wrong id ("Dune" 1984 vs 2021) is rejected instead of saved. The name and image saved still come from TMDB. |
| `status` argument | One of the `LIST_STATUSES` values, as a `z.enum` (the model sees the values). Optional: if omitted, a new title is saved as "Planning to watch", and a title already in the list is left unchanged. |
| Rating | A chat save **never changes the rating**. Today `saveEntry` overwrites every field on a conflict, which would reset the rating to 0. A new store function updates only the status. |
| `userId` | Only from the session, read once in `POST /api/assistant` and passed to tools in `ToolContext`. It's never a tool argument: `parseArgs` already uses `.strict()`, so an extra `userId` key is rejected. |
| Signed-out users | The tool still runs. It looks the title up on TMDB and sends a `sign_in_required` event with the title, poster and status. The model gets a non-error result saying the user must sign in, and writes one short line. The chat shows a sign-in card. The tool stays available when signed out: hiding it would make the model claim "Added". |
| After sign-in | The chat is restored from storage (phase 1). The pending saves are run once through `PUT /api/save-title`, and the chat shows "Added ✓". This only happens if the sign-in started within the last 15 minutes. |
| What the model learns of changes it didn't make | Undo and saves after sign-in happen outside the model. The client sends their keys in `listChanges`. The server reads their **current state from the DB** and puts a bracketed note before the prompt. The note is built by the server, so the model never gets client-supplied list data. |
| Cards show list state | Derived on the client from the `list_saved` parts in the chat (newest wins, undone ones go back to the previous status). Cards don't know about entries that were already in the list before the chat (see Later). |
| `/my-list` freshness | `/my-list` is dynamic (it reads the session), so the server needs no `revalidatePath` from the tool. The client calls `router.refresh()` after a save or Undo, which clears Next's client router cache. |
| Sign-in state for the model | `buildSystemInstruction` gets a `signedIn` flag and adds one line saying whether the user is signed in. |

## Architecture

```
src/modules/chat/
  chatStorage.ts           NEW (1) load/save/clear the session blob, shape check
  useChat.ts               restore + save (1), expired status (2), new events,
                           undo, listChanges (5), resume pending saves (6)
  ChatAssistant.tsx        expired notice (2), list state for cards (5)
  protocol.ts              ChatRequest.listChanges (4); list_saved /
                           sign_in_required events, SavedEntry, PendingSave (3);
                           ListSavedPart, SignInPart (5)
  messageParts.ts          addListSaved, addSignIn, partsToText (5)
  MessageParts.tsx         render the new parts (5)
  ListSavedRow.tsx         NEW (5) "Added ✓ …" + Undo
  SignInCard.tsx           NEW (5) link; (6) provider buttons + pending saves
  RecommendationCard(s).tsx  list status badge (5)
  chatConfig.ts            prompt + signedIn (4)
  llm/llmService.ts        ChatUser in params, tool events, tool choice (3, 4),
                           list-change notes in the input (4)
  tools/types.ts           ToolContext.user, DisplayOutput replaces CardsOutput (3)
  tools/registry.ts        pass the context, generic events (3)
  tools/shared.ts          titleKey moved here from showRecommendations (3)
  tools/saveToList.ts      NEW (3)

src/modules/my-list/
  store.ts                 getEntry, saveEntryStatus (3)
  saveTitle.ts             NEW (3) server-only: TMDB lookup + save, shared by
                           the tool and the resume route

src/app/api/assistant/route.ts   auth(), listChanges, 409 expired (2, 3, 4)
src/app/api/save-title/route.ts  NEW (6)
src/modules/account/actions.ts   signInWithProvider (6)
src/modules/account/AuthBtn.tsx, DeleteModal.tsx   clear the saved chat (1)
src/app/signin/page.tsx          uses signInWithProvider (6)
scripts/check-chat-tools.ts      new tool / signature changes (3, 4)
tests/e2e/chat.spec.ts (+ maybe chat-list.spec.ts)   (7)
```

---

## Phase 1: Chat persistence

**Goal:** the chat survives a refresh and navigating away and back, within the
tab session. No server changes.

### 1.1 `chatStorage.ts` (new)

- `loadChat(): SavedChat | null`, `saveChat(chat)`, `clearSavedChat()`.
- `SavedChat = { version: 1; savedAt: number; messages: ChatMessage[];
  interactionId?: string; stoppedTurns: StoppedTurn[] }`. Later phases add
  optional fields (`listChanges`, `pendingSaves`). Adding an optional field
  doesn't need a version bump, but changing an existing one does.
- Wrap every storage call in try/catch. Storage can be disabled, full or
  blocked. On failure, persistence is off and the chat works as it does today.
  Log at most a `console.warn`.
- `loadChat` returns `null`, and removes the key, when:
  - the JSON is broken
  - the version is different
  - `savedAt` is older than 20 hours (`MAX_SAVED_CHAT_AGE_MS`)
  - the shape check fails
- **Shape check:** use a hand-written guard, not zod (this is client code).
  Check every message's `role`, and each part's required fields by type.
  - Put a `satisfies never` default on the part switch, so phase 5's new part
    types fail the type check until the guard knows them.
  - Throw away the whole blob on any mismatch rather than repairing it. A card
    missing `genres` would crash the render (`genres.join`).
- Only touch `window` inside these functions, never at module level: the home
  page is rendered on the server.
- Export `clearSavedChat` from `src/modules/chat/index.ts`. The account module
  needs it.

### 1.2 `useChat.ts`

**Restore** in a mount effect, never during render. Reading storage during
render causes a hydration mismatch.
- Set `messages`, `interactionIdRef` and `stoppedTurnsRef`.
- **Message ids:** `messageCount` restarts at 0, so `nextId()` would hand out
  `m1` again and collide with restored keys. After restoring, set
  `messageCount.current` past the highest restored id, or switch ids to
  something that can't collide (e.g. a per-load random prefix).
- Keep a `restoredRef` flag. The save effect must do nothing until the restore
  has run, or the first render's empty `messages` overwrites the saved chat.
  This is the main bug to avoid.
- React strict mode runs mount effects twice in dev. Make the restore
  idempotent.

**Save** in an effect on `[messages]`, after the restore:
- It reads the refs. `interactionIdRef` and `stoppedTurnsRef` are written
  before the `setMessages` of the same update (a completed turn, a stop), so
  one effect covers them.
- Don't save in the middle of streaming: `streamingParts` isn't saved.

**Leaving mid-answer:**
- Move the body of `stop()` that builds the stopped message and the stopped
  turn into a helper. `stop()`, the `pagehide` listener and the unmount
  cleanup all use it.
- On `pagehide` (refresh, closing the tab, leaving the site) with a turn in
  flight: build the stopped state and **save synchronously** in the handler.
  There's no later render.
- On unmount (client-side navigation, e.g. to `/my-list`): same, then abort.
  Today the cleanup only aborts.
- A turn that wasn't accepted yet (still in `beforeSend`) saves nothing, as
  with `stop()`.

**Clearing:** `reset()` calls `clearSavedChat()`.

**Don't change** the 10-message cap, the request shape or the error handling
(phase 2).

### 1.3 Clearing on sign-out and account deletion

- `AuthBtn.tsx`: the Sign Out form uses the `SignOut` server action. Clear in
  an `onClick` on its submit button, which runs before the form submits.
- `DeleteModal.tsx`: same for the delete form. Clear only when the user
  submits, not when they open the modal.
- Signing in keeps the chat. That's what phase 6 relies on.

### Watch out

- The chat-disabled variant (`AI_CHAT_ENABLED` not `"true"`) still renders
  `ChatAssistant`, behind an overlay. A restored chat there is harmless, but
  `npm run test:e2e:variants` must stay green.
- reCAPTCHA is unaffected: it runs per send.
- Saved tool parts have no `runningSince`, because the helper runs
  `stopTools` before saving. Check that a restored `ToolCallLine` shows its
  final time and doesn't tick.

### Tests

`chatStorage.test.ts` (unit, with a stubbed `sessionStorage`):
- round trip
- wrong version, broken JSON, too old and wrong shape all return `null` and
  remove the key
- every storage method throwing doesn't throw out of the module

`useChat` / `ChatAssistant` component tests:
- a saved chat is restored on mount, and the next request sends its
  `previousInteractionId` and `stoppedTurns`
- the first render doesn't overwrite the saved chat
- new messages after a restore get unique ids (no duplicate-key warning)
- `reset` clears storage
- `pagehide` during a stream saves a stopped message, and so does unmount
- storage throwing → the chat still works

`AuthBtn` / `DeleteModal`: submitting clears the saved chat.

### Done when

- `npm run lint`, `npx tsc --noEmit`, `npm run typecheck:tests` and
  `npm run test:run` are green.
- `npx playwright test tests/e2e/chat.spec.ts` is green (existing tests; new
  e2e tests are phase 7).
- Manual check (`npm run dev`, stubbed or real chat): refresh keeps the chat,
  `/my-list` and back keeps it, New chat clears it.
- Commit, for example: `feat(chat): keep the chat for the browser session`.

---

## Phase 2: Expired conversations

**Goal:** a restored chat whose Gemini interaction is gone shows a clear
notice, not "something went wrong".

### 2.1 Server (`app/api/assistant/route.ts`)

Today any failure to start returns `502 "Failed to start chat"`.

- When the request had a `previousInteractionId` and starting failed, find out
  whether the interaction is gone, and return
  `409 { error: "conversation_expired" }` if so. Everything else stays 502.
- **Don't guess the error from the status alone.** An invalid API key is also
  a 4xx. Use one of these, in order of preference:
  1. After the failure, call `ai.interactions.get(previousInteractionId)`. A
     404 means it's gone. This needs the GenAI client in the route, or a small
     `isInteractionGone(id)` exported from `llmService.ts`: the route doesn't
     import `@google/genai` itself, and should stay that way.
  2. If `get` doesn't exist or doesn't behave like that, match the specific
     error status and message the API returns for an unknown
     `previous_interaction_id`.
- Find the real behaviour with a live call: a bogus id like `v1_doesnotexist`,
  using the same env as `npm run check:chat-tools`. Write the status and
  message in the log.
- If there's no key: implement option 1, test it with mocks, and mark the phase
  `done with gaps`.

### 2.2 Client

- `useChat`: on a 409 with that error, set a new status `"expired"` (add it to
  `ChatStatus`). Also clear `interactionIdRef` and `stoppedTurnsRef`. The
  existing "no interaction created" path already does this for errors.
- Keep the restored messages and the user message just sent.
- `ChatAssistant`: show a notice like the error one. Suggested text:
  - "This conversation is too old to continue. Send your message again to
    start fresh — the assistant won't remember the messages above."
  - plus the existing New chat button.
- The saved blob keeps the messages, without the dead interaction id.

### Tests

- Route integration test (mocked Gemini): with a previous id and a
  not-found → 409. Without a previous id, the same error → 502. An
  auth/quota-style error with a previous id → 502.
- `useChat` / `ChatAssistant`: a 409 shows the notice, and the next send has
  no `previousInteractionId`.

### Done when

- Lint, tsc, `typecheck:tests` and `test:run` are green. `chat.spec.ts` is
  green.
- The live result is in the log, or recorded as not run, with why.
- Commit, for example: `feat(chat): tell the user when a saved conversation
  expired`.

---

## Phase 3: List service and the `save_to_list` tool

**Goal:** the model can save a title to the signed-in user's list. Server only.
The client ignores the new events until phase 5, so users only see the model's
text.

### 3.1 Store (`my-list/store.ts`)

- `getEntry(userId, key): Promise<StoredEntry | undefined>`: one select by
  `userId`, `movieId` and `type`.
- `saveEntryStatus(userId, { movieId, type, name, image, status })`:
  - inserts with `rating: 0`
  - on a conflict, updates **only `status`**: not the rating, and not the
    name or image, so the list doesn't change what the user saw there
  - one statement, like `saveEntry`
- Don't change `saveEntry`: the dialogs rely on it.
- Export both from `my-list/server.ts`.

### 3.2 Save service (`my-list/saveTitle.ts`, new, `server-only`)

```ts
saveTitle(userId, { type, id, title, status? }, { signal })
  → { entry: SavedEntry; previous: PreviousEntry | null }
```

1. `getTitle(type, id, { signal })`.
2. Reject with a domain error (not a `ToolError`, this module isn't chat
   code) when:
   - TMDB returns a 404
   - the title is adult (same as the cards, without naming it)
   - `titleKey(title)` matches neither `title` nor `originalTitle`
3. Read `previous = getEntry(...)`.
4. Write:
   - no `status` and already in the list → write nothing, return the entry with
     its current status
   - no `status` and new → "Planning to watch"
   - otherwise → `saveEntryStatus`
5. `image` = `backdropPath || posterPath || ""`, like the cards'
   "Add to list".
6. Return `SavedEntry = { type, id, title, posterPath, image, status }` and
   `previous` as `{ name, image, status, rating } | null`. `previous` is what
   Undo restores.

Steps 3 and 4 are two statements. A concurrent edit in between can make Undo
restore slightly stale data. That's acceptable; say so in a comment.

**Where `titleKey` lives:** `titleKey` and `NOT_LETTER_OR_DIGIT` move from
`showRecommendations.ts` to a module both chat and my-list can import:
- if `saveTitle.ts` imports from `chat/tools/shared.ts`, the dependency points
  from my-list into chat, which is the wrong direction;
- so put them in `src/shared/lib/` (e.g. `titleKey.ts`) and import them from
  both.

### 3.3 Session in the chat (`route.ts`, `llmService.ts`, `tools/types.ts`)

- `ToolContext` gets `user: ChatUser`:

  ```ts
  type ChatUser =
    | { status: "signed_in"; id: string }
    | { status: "signed_out" }
    // auth() threw (e.g. DB down)
    | { status: "unavailable" };
  ```

- The route calls `auth()` once, before `streamChatReply`, and builds a
  `ChatUser`.
  - If `auth()` throws: log it, use `unavailable` and carry on. The chat must
    not fail because of the session.
  - `auth()` already works on the edge runtime: the home page uses it.
- `streamChatReply({ …, user })` → `runToolCalls(calls, { signal, user })` →
  `tool.run(args, ctx)`. The timeout signal still replaces `signal` per call.
- Check `tests/setup/shared.ts` for how auth is mocked globally. The route
  integration tests mock `@/infra/auth/auth` like
  `addToList.route.int.test.ts`.

### 3.4 Tool events (`tools/types.ts`, `registry.ts`, `llmService.ts`)

- Replace `CardsOutput` / `ToolResult.cards` with one generic mechanism:
  - `DisplayOutput(output, events)`
  - `ToolResult.events?: ToolEvent[]`
  - `ToolEvent = Extract<ChatStreamEvent, { type: "cards" | "list_saved" |
    "sign_in_required" }>`
- `show_recommendations` returns `new DisplayOutput(output, [{ type: "cards",
  items }])`, and only when there are items.
- `runTurn` yields every result's events in call order, after the
  `tool_end`s, as it does for cards today.
  - `shownCards` becomes "some event is `cards`".
  - Keep the existing behaviour and tests: this is a refactor for cards.

### 3.5 Protocol (`protocol.ts`)

```ts
// the row a save wrote (or found, when nothing changed)
export type SavedEntry = {
  type: MediaType;
  id: number;
  title: string;
  posterPath: string | null;
  // what the list row shows, like the cards' "Add to list"
  image: string;
  status: ListStatus;
};
// the row before the save, for Undo; null when the title was new
export type PreviousEntry = {
  name: string;
  image: string;
  status: string; // not ListStatus: see StoredEntry
  rating: number;
};
// a save that needs the user to sign in first
export type PendingSave = {
  type: MediaType;
  id: number;
  title: string;
  posterPath: string | null;
  // null: "Planning to watch" for a new title, unchanged otherwise
  status: ListStatus | null;
};

| { type: "list_saved"; entry: SavedEntry; previous: PreviousEntry | null }
| { type: "sign_in_required"; save: PendingSave }
```

- `ListStatus` is a type-only import from `@/modules/my-list`.
- Export the new types from `chat/index.ts`.

### 3.6 `tools/saveToList.ts` (new)

- Args (`zod/v4`, strict via `parseArgs`):
  - `type`: `mediaTypeArg`
  - `id`: positive int, described like in `show_recommendations`
  - `title`: string, 1–300
  - `status`: `z.enum(LIST_STATUSES values).optional()`, described:
    "Omit to add a new title as Planning to watch, or to leave a title already
    in the list as it is"
- Description: says what it does, that it only works on the signed-in user's
  own list, and what it returns. Write it for the model, like the other tools.
- `status`: "Saving to your list...".
- `run(args, { signal, user })` by `user.status`:
  - `signed_in`: `saveTitle(user.id, …)`. Map domain errors to `ToolError`s
    (`"not found on TMDB"`, `"not available"`,
    `"the id is \"X\", not \"Y\""`). Return
    `DisplayOutput({ saved: { id, type, title, status }, previousStatus },
    [list_saved event])`.
  - `signed_out`: look the title up (same 404, adult and title checks, so the
    sign-in card is for a real title). Return `DisplayOutput({ saved: false,
    reason: "The user isn't signed in. The chat shows them a sign-in button
    for this title." }, [sign_in_required event])`. This is **not** an
    error result: nothing failed, and an error result makes the model say
    "I can't look titles up".
  - `unavailable`: `ToolError("Can't save right now, try again later")`. No
    TMDB call.
- TMDB down → let `TmdbError` propagate. The registry reports it like any
  failed lookup.
- Register it in `CHAT_TOOLS`.

### Watch out

- **Never** read a user id from args, and don't add an optional `userId` to
  the schema "for tests". The context is the only source.
- Two `save_to_list` calls for the same title in one round run in parallel,
  in no fixed order. The prompt (phase 4) asks for one call per title. Don't
  add registry-level dedup unless a test shows it's needed.
- **Why no confirm step** (for reviewers):
  - Gemini would pause in `requires_action`, and the tool loop runs inside one
    streaming edge request.
  - Waiting for a click means ending the stream and continuing in a new POST.
  - That POST can't trust the client's copy of the arguments, so the server
    would have to fetch the call back from Gemini.
  - It would also have to send a "declined" result if the user typed instead
    of clicking.

### Tests

`store.int.test.ts` (real test DB):
- `saveEntryStatus` inserts with rating 0
- on a conflict it changes only the status (rating, name and image kept)
- `getEntry` finds the entry by key, and movie/TV ids that collide stay
  separate

`saveTitle` (integration, TMDB mocked with `mockTmdb`):
- new title → planning
- existing title + status → status changed, rating kept, `previous` returned
- existing title, no status → no write
- 404, adult and title mismatch are rejected with nothing written

`saveToList.test.ts` / route integration (mocked Gemini calls `save_to_list`,
real DB):
- signed in → the entry is in the DB and the stream has `list_saved`
- **signed out** → no DB write, the stream has `sign_in_required` with the
  TMDB title, and the model result isn't an error
- **invalid id** (TMDB 404) → error result, no write
- **invalid status** → the args are rejected
- **already in the list** → updated, rating kept
- **another user's list:** an extra `userId` arg is rejected by strict
  parsing, and the row is written for the session user only (seed two users,
  check the other's list is untouched)
- `unavailable` → error result, no TMDB call
- the cards refactor: the existing `show_recommendations` and `llmService`
  tests stay green unchanged, apart from `cards` → `events`

### Done when

- Lint, tsc, `typecheck:tests` and `test:run` are green.
- `npm run check:chat-tools` passes with a real key, so Gemini accepts the new
  schema. If there's no key, log it as not run.
- Commit(s), for example: `feat(my-list): save a title's status without
  touching its rating` and `feat(chat): add save_to_list tool`.

---

## Phase 4: Prompt, sign-in state, tool choice and list-change notes

**Goal:** the model uses the tool well, knows whether the user is signed in,
and learns about list changes it didn't make (Undo, saves after sign-in).

### 4.1 Sign-in state (`chatConfig.ts`, `llmService.ts`, check script)

- `buildSystemInstruction(date, { signedIn })`, and `baseRequest({
  signedIn })`.
- `signedIn` means `user.status === "signed_in"`. `unavailable` counts as
  signed out for the prompt; the tool still answers with its own error.
- Update `scripts/check-chat-tools.ts`, which calls `baseRequest()`.

### 4.2 Prompt

Add to the existing sections, keeping the style: short imperative bullets.

- **Task:** the assistant can also add titles to the user's list and change
  their status, when the user asks.
- **Tools:**
  - Call `save_to_list` only when the user asks to save or change a title.
    Never on your own initiative.
  - "The second one" etc. means that position in the latest cards (the
    existing bullet). For a title named but not shown in this conversation,
    `search_titles` first.
  - If the name matches several titles (e.g. Dune 1984 / 2021) and the
    conversation doesn't say which, ask which one. This is the one exception
    to "don't ask clarifying questions first".
  - Statuses: "watchlist", "want to watch", "save for later" → Planning to
    watch; "watching", "started" → Watching; "watched", "seen", "finished" →
    Completed. If the user names no status, omit it.
  - One call per title. Several titles go in parallel calls in the same round.
- **Output format:**
  - After `save_to_list`, write one short line. The chat already shows what
    was saved, so don't repeat statuses.
  - Never say a title was saved unless the tool returned it as saved.
  - Signed out: still call the tool, so the chat shows a sign-in button for
    the title, then ask in one short line to sign in.
- **Context line:** "The user is signed in." / "The user is signed out."
- **Notes:** "Lines in brackets that start with `[List update:` are added by
  the app: they're the current state of those titles in the user's list."
- **Rules:** extend the "unrelated topics" rule: managing the list counts as
  related.
- Update the example section only if needed. Keep the prompt short.

### 4.3 Tool choice (`llmService.ts`)

- Rename `DISPLAY_ONLY_TOOL_CHOICE` → `FINAL_ROUND_TOOL_CHOICE` and allow
  `[SHOW_RECOMMENDATIONS, SAVE_TO_LIST]`. Mode stays `validated` (see the
  recommendation-cards log: `auto` is rejected).
  - Update its uses: the check script and `assistant.route.int.test.ts`.
- After a round that showed cards, the next request still sends `"none"`. So
  "recommend X and add the first one" can't save in the same turn; the user
  asks again. That's accepted, so don't build anything for it, and say so in
  the comment.

### 4.4 List-change notes (`protocol.ts`, `route.ts`, `llmService.ts`)

- `ChatRequest.listChanges?: EntryKey[]`, with `{ movieId, type }` keys and at
  most 10. Validate in the route schema (`movieId` a positive int, `type`
  movie/tv).
- Signed in, non-empty: read the user's entries, `getEntries(userId)` filtered
  by the keys (or `getEntry` per key). Build **one** note step before the
  prompt, after the stopped turns:

  ```
  [List update: Dune: Part Two (movie 693134) is Completed; Fury (movie 228150) is not in the list]
  ```

  - Use the stored `name`, `status` and the key.
  - A key not in the list → "is not in the list".
  - Signed out, or a DB error → no note. Log the DB error but don't fail the
    chat.
- `buildChatInput(prompt, stoppedTurns, note?)` emits it as a `user_input`
  step. Today `buildChatInput` returns the bare prompt string when there are
  no stopped turns; with a note it must return steps.
- The note is built by the server from the DB. Never pass client text through
  it.

### Tests

- `chatConfig.test.ts`: the signed-in / signed-out line, and the new rules
  are present.
- `buildChatInput.test.ts`: the note comes before the prompt, after the
  stopped turns; with no note, the output is unchanged.
- Route integration:
  - `listChanges` for signed in → the note is built from the DB (seed an entry,
    check the `input` sent to Gemini)
  - signed out → no note
  - invalid `listChanges` → 400
  - the final round allows both tools
- Existing tool-choice tests pass with the renamed constant.

### Done when

- Lint, tsc, `typecheck:tests` and `test:run` are green.
  `npm run check:chat-tools` passes, or is logged as not run.
- Manual check with a real key, if available. Record each result:
  - "add the second one to my watchlist" after cards → saved as Planning
  - "mark Dune as completed" → asks which Dune, or picks the one in context
  - signed out → one short sign-in line
- Commit, for example: `feat(chat): prompt the model to manage the list`.

---

## Phase 5: Chat UI for list changes

**Goal:** saves show in the chat with Undo, cards show the new state, and
signed-out users see a sign-in card. In this phase the card links to
`/signin`; the chat comes back after sign-in thanks to phase 1, but the title
isn't saved yet.

### 5.1 Parts (`protocol.ts`, `messageParts.ts`)

```ts
export type ListSavedPart = {
  type: "list_saved";
  entry: SavedEntry;
  previous: PreviousEntry | null;
  // the user undid it from the chat
  undone?: boolean;
};
// one per message: every sign_in_required of the answer goes in it
export type SignInPart = { type: "sign_in"; saves: PendingSave[] };
```

- `addListSaved(parts, event)`: appends a part.
- `addSignIn(parts, save)`: adds to the message's existing `sign_in` part
  (dedupe by key), or appends one.
- `partsToText` (what the model sees of a stopped answer):
  - list_saved → `[Saved to list: Dune: Part Two (movie 693134) as Completed]`,
    with ` (undone)` when undone
  - sign_in → `[Asked to sign in to save: …]`
- Update `isWaitingForModel`: a `list_saved` / `sign_in` part last means the
  model is working on its next round, like `cards`.
- Update the phase 1 shape check in `chatStorage.ts` (its `satisfies never`
  forces this).

### 5.2 `useChat.ts`

- Handle `list_saved` and `sign_in_required`.
- `undoSave(messageId, partIndex)`:
  - only on finished messages: hide Undo while the answer is streaming
  - the server call:
    - `previous === null` → `DELETE /api/remove-from-list` (headers `movieId`
      and `type`)
    - otherwise → `PUT /api/add-to-list` with `{ movieId, title:
      previous.name, image: previous.image, status: previous.status, rating:
      previous.rating || "", type }`. `rating` 0 means "not rated", which the
      route takes as `""`.
  - A legacy `previous.status` outside `LIST_STATUSES` gets a 400. Show the
    error toast and leave the part as is.
  - On success: mark the part `undone` (via `setMessages`, so it's saved),
    push the key to `listChangesRef`, and call `router.refresh()`.
- `listChangesRef`: deduped keys, saved in the blob.
  - Sent as `listChanges` with the next request.
  - Cleared only after a turn **completes**, so a failed send keeps them.
  - Cleared by `reset()`.
- After a `list_saved` event: `router.refresh()`, at most once per turn (e.g.
  when the turn completes, if it had a save). Calling `useRouter` inside
  `useChat` is fine, or pass a callback in from `ChatAssistant`.

### 5.3 Components

**`ListSavedRow.tsx`:**
- A compact row: small poster, then:
  - "Added to your list · Planning to watch"
  - "Moved to Completed (was Watching)"
  - "Already in your list · Watching" (when nothing changed)
- An Undo button, hidden when nothing changed.
- When undone: "Undone" text, no button.
- `aria-live="polite"` only on the streaming message, so restored history
  isn't announced.

**`SignInCard.tsx`:**
- Poster and "Sign in to add **Dune: Part Two** to your list". With several
  titles: "Sign in to add 3 titles to your list", with the names listed.
- In this phase, one link: `/signin?callbackUrl=/`.

**Cards:**
- `ChatAssistant` derives `listStatus: Map<"type-id", ListStatus | null>`
  from `messages` + `streamingParts`, newest wins. Undone → the `previous`
  status, or `null` (not in the list).
- Pass it down the same way as `signedIn`.
- `RecommendationCard` shows a badge "In your list · Completed" when known.
  The "Add to list" button stays.
- **Keep `RecommendationCards`' `memo` working:**
  - every streamed delta re-renders the chat, so a new `Map` per render
    re-renders every card
  - pass each card only its own status (a string or null), not the map
  - or memoize the map on a derived signature string

### Watch out

- The existing `ListEntryDialog` "Add to list" on a card and a chat save write
  the same row. The badge only reflects chat saves; that's fine.
- Undo uses the existing routes as they are. Don't change their response shape
  (`{ addToListResult }`): `ListEntryDialog` depends on it.

### Tests

- `messageParts.test.ts`: add/merge/dedupe sign-in, `partsToText` for both
  parts and undone, `isWaitingForModel`.
- `chatStorage.test.ts`: the new parts round-trip, and a malformed one is
  rejected.
- Component tests:
  - `ListSavedRow`: each wording, Undo calls the right route with the right
    body, undone state, error toast on failure
  - `SignInCard`: one and several titles, link href
  - `RecommendationCard`: the badge
- `ChatAssistant` / `useChat`:
  - events render
  - Undo marks undone and the next request carries `listChanges`
  - `listChanges` is cleared after a completed turn and kept after a failed one
  - `router.refresh` is called

### Done when

- Lint, tsc, `typecheck:tests` and `test:run` are green. `chat.spec.ts` is
  green.
- Manual check with `stubAssistant`-style events or a real key: the row, Undo,
  the badge and the sign-in card look right at 320 px and on desktop.
- Commit, for example: `feat(chat): show list changes with undo in the chat`.

---

## Phase 6: Sign-in round trip

**Goal:**
- the sign-in card signs in directly with Google or GitHub
- after the redirect back, the chat is restored and the pending titles are
  saved without asking again
- the model is told about it

### 6.1 Sign-in action (`account/actions.ts`, `signin/page.tsx`)

- `signInWithProvider(formData)`: reads `provider` (`google` | `github`, reject
  others) and `callbackUrl`, and calls `signIn(provider, { redirectTo })`.
- Move `safeRedirect` out of `signin/page.tsx` into a shared helper, and use it
  in both places. Its rules are security-relevant: keep them exactly (path
  only, no `//`, no `/signin` loop).
- `signin/page.tsx` uses the shared action instead of its inline one. Same
  behaviour.

### 6.2 `SignInCard.tsx`

- Replace the link with two provider buttons in a form with
  `action={signInWithProvider}`, a hidden `callbackUrl=/`, and button
  `name="provider"`. Same look as the sign-in page buttons, smaller.
- In the buttons' `onClick` (which runs before the form submits), write
  `pendingSaves: { saves, since: Date.now() }` to the saved blob through
  `chatStorage`, then let the submit continue.
  - Don't rely on `pagehide` for this. The chat itself is already saved by
    phase 1.
- Keep a plain "Other sign-in options" link to `/signin?callbackUrl=/`.

### 6.3 Resume save route (`app/api/save-title/route.ts`, new)

- `PUT`, Node runtime (like `add-to-list`).
- `auth()` → 401 `{ error: "signed_out" }` without a user.
- Body: `zod` v3 `{ type, id, title, status: ListStatus | null }`
  (`PendingSave` minus `posterPath`) → 400.
- `saveTitle(userId, …)` from phase 3:
  - not found / adult / mismatch → 422
  - TMDB failure → 502
  - success → 200 `{ entry, previous }`, the same payload as the `list_saved`
    event, so the client renders it with the same row
- `userId` only from the session (as everywhere).

### 6.4 Resume on the client (`useChat.ts` or a small `useResumeSaves`)

After the restore, when `signedIn` is true and the blob has `pendingSaves`:

1. Check `since`: older than 15 minutes (`PENDING_SAVE_MAX_AGE_MS`) → drop
   them and do nothing. The user didn't just sign in for them.
2. **Remove `pendingSaves` from storage before any request**, so a refresh
   mid-request, or the dev strict-mode double effect, can't save twice. Guard
   the effect with a ref too.
3. `PUT /api/save-title` for each save (in parallel is fine, at most 10).
4. Append **one** assistant message with a `list_saved` part per success, and
   a short text part for failures ("Couldn't save Dune — try again from the
   card."). Push the successful keys into `listChangesRef`, and call
   `router.refresh()`.

When `signedIn` is false, keep `pendingSaves` until they expire: the user may
have cancelled OAuth and will try again. The sign-in card still works.

`ChatAssistant` already gets `signedIn` from the page, rendered after the
redirect, so it's correct on return.

### Watch out

- The OAuth redirect leaves the site and comes back in the same tab, so
  `sessionStorage` survives. A sign-in that opens in a new tab (rare, e.g.
  middle-click) won't see the blob. That's acceptable.
- The server action redirect throws `NEXT_REDIRECT` by design. Don't catch it
  (the existing page rethrows; keep that).
- On return, the model's history still has the "user isn't signed in" result.
  The phase 4 sign-in line and the list-change note correct that on the next
  message. Don't add anything else.

### Tests

- `save-title` route integration (real DB, TMDB mocked):
  - 401 signed out
  - 400 bad body
  - 422 not found / mismatch
  - 200 saves for the session user only (an extra `userId` in the body is
    ignored, and the other user's list is untouched)
  - rating kept on a status change
- `signInWithProvider` / `safeRedirect`: the existing redirect cases move with
  the helper; an unknown provider is rejected.
- `SignInCard`: clicking a provider writes `pendingSaves` with `since`.
- Resume:
  - signed in + fresh → one request per save, pending cleared before the
    request, rows appended, `listChanges` set
  - stale → nothing sent
  - signed out → kept
  - running twice (strict mode) → one request per save
  - a failed save → text part

### Done when

- Lint, tsc, `typecheck:tests` and `test:run` are green. `chat.spec.ts` and
  `auth.spec.ts` are green.
- Manual check with real OAuth in dev, if configured: signed out → "add Fury
  to my watchlist" → sign-in card → Google/GitHub → back in the same chat
  with "Added ✓" → Fury in `/my-list`. Log the result, or not run and why.
- Commit, for example: `feat(chat): save the pending titles after sign-in`.

---

## Phase 7: E2E, manual checks, cleanup

**Goal:** the whole feature is covered end to end on desktop and mobile, and
the code is tidy.

### E2E

Use `stubAssistant` / `answer` from `tests/e2e/helpers/chat.ts` and `loginAs`
from `tests/e2e/fixtures.ts`. Put them in `chat.spec.ts`, or in a new
`chat-list.spec.ts` if `chat.spec.ts` gets too long.

- **Persistence:**
  - a chat survives `page.reload()`, and the follow-up request has the
    `previousInteractionId`
  - going to `/my-list` and back keeps it
  - New chat → reload → empty
  - sign out → empty
  - reload during a held stream → a stopped message after reload
- **Expired:** the stub returns 409 `conversation_expired` → the notice, and
  the next request has no `previousInteractionId`.
- **Saved row:** a stubbed `list_saved` event → the row, the card badge, and
  Undo → calls the remove route (check with the real DB that the entry is gone,
  after seeding it with `loginAs` + the db fixture).
- **Sign-in round trip:**
  - signed out, a stubbed `sign_in_required` → sign-in card
  - click GitHub → intercept the provider redirect
    (`page.route("https://github.com/**", …)`)
  - `loginAs` → `page.goto("/")` → the chat is restored, "Added ✓" shows, and
    `/my-list` lists the title (the real `/api/save-title` with the mocked
    TMDB server)
- **Mobile (320 px):** the row and the sign-in card don't overflow, and the
  buttons can be tapped.
- `npm run test:e2e:variants` stays green.

The real `save_to_list` → DB path is covered by the phase 3 route integration
test, because e2e stubs `/api/assistant` in the browser. Don't try to drive
Gemini from e2e.

### Manual checks with a real key (can't be mocked)

Record each as passed, failed (what happened) or not run (why):

1. Cards → "add the second one to my watchlist" → the right title, Planning.
2. "mark Dune as completed" → disambiguates or uses the context; the rating is
   kept if Dune was already rated.
3. "add all of them" after 5 cards → 5 rows, no duplicates.
4. Signed out → sign-in card + one short line; after sign-in → saved, and the
   next message ("what's on my list?" is out of scope; try "add another one
   like it") behaves as signed in.
5. Undo, then ask "is it in my list?" → the model's answer matches the
   list-change note.
6. Refresh mid-answer → a stopped message; the follow-up continues.
7. A chat restored after the interaction expired (if you can't wait a day,
   trust the phase 2 mock test and say so).

### Cleanup

- Remove dead code, e.g. any leftover `CardsOutput` references or unused
  exports.
- Read the tool and prompt texts once more for length and consistency.
- Check that no `console.log` is left, and that `console.warn` / `console.error`
  messages say what failed.

### Done when

- All unit, integration and component tests are green. The default e2e run
  and the variants are green.
- Every manual check has a result in the log.
- Commit, for example: `test(e2e): cover chat persistence and list changes`.

---

## Later (not in this plan)

- `remove_from_list` and `rate_title` tools.
- A read-only `get_my_list` tool ("what's on my list?", and which Dune the user
  already has).
- Cards that know the user's existing entries:
  - `show_recommendations` would add `listStatus` when signed in, with one
    `getEntries` query
  - this would remove the "badge only after a chat save" gap
- The same pending-save + sign-in flow for the signed-out "Add to list" button
  on search and details pages, which today only shows a toast.
- Rebuilding context from the saved messages when a conversation has expired,
  instead of starting fresh.

---

## Progress log

Add an entry when a phase ends, newest last. Don't rewrite earlier entries;
if one turns out wrong, correct it in your own entry. Keep it short: write
only what the next agent can't easily see from the diff or the plan, such as
surprises, deviations, workarounds, flaky tests and checks that weren't run.
Don't restate the diff.

Template:

```md
### Phase N: <title>

- **Status:** done | done with gaps | blocked
- **Commits:** <short hash> <title>, …
- **Deviations from the plan:** what changed and why (or "none")
- **For the next phase:** facts, gotchas, decisions it must respect (or "none")
- **Checks:** what ran and the result; what didn't run and why
```

<!-- entries go below this line -->

### Phase 1: Chat persistence

- **Status:** done
- **Commits:** see `feat(chat): keep the chat for the browser session` (this entry is in it)
- **Deviations from the plan:**
  - The "restore has run" flag is **state**, not a ref. Strict mode re-runs
    the mount effects with the first render's state (`messages = []`), so a
    ref set by the first run would let the second run save `[]` over the chat.
  - The save effect runs on `[messages, status, restored]`, not just
    `[messages]`. A failed turn clears `interactionIdRef` without changing
    `messages`, and only `setStatus("error")` follows, so this is what saves
    the cleared id. Phase 2's `"expired"` status gets saved the same way.
  - Restoring doesn't save again (skipped while `messages` is the restored
    array), so reloads don't extend `savedAt`. An empty chat clears the key
    instead of saving an empty blob.
  - `DeleteModal` clears in the form's `onSubmit`, not the button's `onClick`:
    `onClick` also fires on a submit blocked by the required input. It only
    clears when the confirmation text is "Delete account", the same check
    the action does. Sign-out uses `onClick` as planned.
  - The shape check also rejects tool parts with `runningIds` or
    `runningSince`. Saved lines are always stopped, so one that's running
    would show a spinner forever.
- **For the next phase:**
  - `tests/setup/components.tsx` clears `sessionStorage` after each component
    test (after `cleanup()`, since unmounting the chat can save).
  - `stop()`, `pagehide` and unmount all go through `stopTurn({ saveNow })`.
    `saveNow` writes the blob synchronously from `messagesRef`.
  - New saved fields (`listChanges`, `pendingSaves`) need to be added in three
    places: `SavedChat`, `isSavedChat`, and the restore/save effects in
    `useChat`. New part types need a case in `isPart`; its `satisfies never`
    makes the type check fail until they have one.
  - In dev, strict mode runs the `setMessages` updaters twice, so `nextId()`
    skips numbers (`m2`, `m4`, …). This was already the case and is harmless:
    ids stay unique, and a restore continues after the highest one.
  - `AuthBtn` and `DeleteModal` import `clearSavedChat` from `@/modules/chat`
    (the index, as planned). That index also re-exports `ChatAssistant`.
- **Checks:**
  - `npm run lint`, `npx tsc --noEmit`, `npm run typecheck:tests` and
    `npm run test:run` (970 tests) are green.
  - `npx playwright test tests/e2e/chat.spec.ts` (15) and
    `npm run test:e2e:variants` are green.
  - The manual check was scripted, not done by hand. A throwaway Playwright
    spec (deleted afterwards) ran on the e2e web server with `stubAssistant`
    and `loginAs`, and passed: a refresh keeps the chat and its cards;
    `/my-list` and back through the navbar links (client-side) keeps it, and
    the follow-up sends `previousInteractionId`; New chat, then a reload,
    leaves it empty; a reload during a held stream shows a stopped message,
    and the next request carries it in `stoppedTurns`. It wasn't checked by
    hand in `npm run dev`.

### Phase 2: Expired conversations

- **Status:** done
- **Commits:** see `feat(chat): tell the user when a saved conversation expired` (this entry is in it)
- **Deviations from the plan:** none in the design (option 1, `interactions.get`).
  - The notice has no button of its own; the header's New chat button is the
    "existing" one the plan mentions.
  - A 409 without `{ error: "conversation_expired" }` (or without JSON) is a
    plain error on the client.
  - The expired path logs `console.info`, not `console.error`, on both
    sides: it's expected after a day.
- **For the next phase:**
  - Live behaviour (real key, `gemini` via the app's `CHAT_MODEL`, SDK
    2.24.0), checked by deleting a real interaction with
    `interactions.delete` and continuing from it:
    - `create` with that `previous_interaction_id` and `get(id)` both throw
      `NotFoundError`, `status: 404`, body
      `{"error":{"message":"Requested entity was not found.","code":"not_found"}}`.
      A well-formed id that never existed behaves the same.
    - A malformed id (`v1_doesnotexist`) is a **400** "Invalid interaction
      name" from `get` and "Invalid JSON payload" from `create`, so it stays
      a 502. Only ids Gemini issued can expire, so that's fine.
    - An invalid key is a 400 `BadRequestError` from both.
    - The app's `isInteractionGone` against the live API: an existing id gives
      false, a deleted one true, a malformed one false.
  - The route calls `get` after **any** failed start that had a previous id.
    It costs one extra request on those failures only. It re-checks the abort
    after the lookup, so a client that left during it still gets the quiet
    499.
  - The route test's `@google/genai` mock now has `interactions.get` (`get`
    in the hoisted mocks). It's reset in `beforeEach` and returns
    `undefined` by default, i.e. "the interaction exists".
  - `ChatErrorResponse` is in `protocol.ts`. It isn't exported from the chat
    index because nothing outside the module uses it.
- **Checks:**
  - `npm run lint`, `npx tsc --noEmit`, `npm run typecheck:tests` and
    `npm run test:run` (982 tests) are green.
  - `npx playwright test tests/e2e/chat.spec.ts` (15) is green.
  - The live result above ran with the real key. A chat that actually
    expired after a day wasn't waited for. Deleting the interaction gives the
    same 404.

### Phase 3: List service and the `save_to_list` tool

- **Status:** done
- **Commits:** `feat(my-list): save a title's status without touching its rating`,
  then `feat(chat): add save_to_list tool` (this entry is in it)
- **Deviations from the plan:**
  - `save_to_list` loads `@/modules/my-list/server` with a lazy `import()`
    inside `run`. The list's server code loads React (`cache` in `store.ts`)
    and the DB client. `check:chat-tools` runs under `--conditions=react-server`,
    where stable React throws on import, and unit tests have no
    `DATABASE_URL`. So the statuses in the schema are a literal tuple, which
    tsc checks against `ListStatus` both ways (`LIST_STATUSES` is only
    reachable through my-list's index, which has components, or `/server`).
  - `SavedEntry` and `PreviousEntry` are defined in `my-list/entry.ts` and
    re-exported from `protocol.ts`, so my-list doesn't import from chat.
    `PendingSave` is in `protocol.ts` as planned.
  - The domain error is `SaveTitleError` with `rejection.reason`
    `not_found | not_available | title_mismatch`. `checkTitle` (lookup and
    checks, no write) is exported too; the signed-out path uses it.
  - `matchesTitle` (`shared/lib/titleKey.ts`) also rejects a name without
    letters or digits: its key `""` used to match a missing original title.
    This applies to `show_recommendations` too.
  - A row with a legacy status, saved without a status, is set to "Planning
    to watch" (rating kept), because `SavedEntry.status` is a `ListStatus`.
    `previous` keeps the legacy status, so Undo gets the 400 the plan
    expects in phase 5.
  - A row that's already in the list keeps its image, and `entry.image` is
    the stored one. `saveTitle` doesn't write if the signal aborted during
    the lookups.
  - One phase 4 prompt bullet was added now: "Call save_to_list only when
    the user asks to save a title to their list or change its status. Never
    on your own initiative." The "names every tool" test needs it, and
    without it the model could save on its own. Keep it in phase 4
    (`chatConfig.test.ts` checks it).
  - `runToolCalls(calls, ctx)` takes the whole `ToolContext`. Tests build one
    with `toolContext(signal?, user?)` from `chat/testing/toolContext.ts`
    (signed out by default).
- **For the next phase:**
  - `ChatUser` is exported from `chat/server.ts`. The route reads the session
    once, after validating the body. If `auth()` throws, the user is
    `unavailable` and the route logs a `console.error`.
  - `assistant.route.int.test.ts` now mocks `@/infra/auth/auth`. The top
    `beforeEach` calls `asUser(null)`; tests call `asUser(user)` to sign in.
  - A save doesn't count as cards: the next round's tool choice stays
    `"auto"`. Only cards switch it to `"none"`.
  - Live, signed out, "Add the movie Fury (2014, Brad Pitt) to my watchlist":
    the model called `search_titles`, then `save_to_list` without a status,
    so the stream had `sign_in_required` (`status: null`), then "Please sign
    in to your CineRadar account to add titles to your watchlist." Phase 4's
    status mapping should make "watchlist" explicit.
  - Under a local `next start` without `AUTH_TRUST_HOST`, Auth.js logs
    `UntrustedHost` and returns no session, so the chat is signed out. For
    signed-in manual checks use `npm run dev`, or set `AUTH_TRUST_HOST=true`.
- **Checks:**
  - `npm run lint`, `npx tsc --noEmit`, `npm run typecheck:tests` and
    `npm run test:run` (1034 tests) are green.
  - `npm run check:chat-tools` with the real key passed: both requests were
    accepted with 10 tools.
  - `npx playwright test tests/e2e/chat.spec.ts` (15) is green. It stubs
    `/api/assistant`, so it doesn't load the route.
  - A production build into a throwaway `NEXT_DIST_DIR` compiled the edge
    route. One real signed-out request against it gave the stream above. A
    signed-in save wasn't tried live; the route integration tests cover it
    with the real DB.

### Phase 4: Prompt, sign-in state, tool choice and list-change notes

- **Status:** done
- **Commits:** see `feat(chat): prompt the model to manage the list` (this entry is in it)
- **Deviations from the plan:**
  - The note is built in `llm/listChangeNote.ts`, called from
    `streamChatReply` (new `listChanges` param), not in the route. It loads
    `@/modules/my-list/server` lazily, like `save_to_list`, so the check
    script still loads `llmService`. One `getEntries` query, not one per key.
  - A key that isn't in the list has no row, so no name: the note says
    `movie 228150 is not in the list`, not `Fury (movie 228150) …` as in the
    plan's example. The model links the id from its history (live: right 5
    of 5 times).
  - Stored names come from the add-to-list route, i.e. any text, so the note
    turns runs of brackets and whitespace into one space and caps names at
    300 characters. Repeated keys are listed once.
  - `buildSystemInstruction(date, { signedIn })` defaults to signed out;
    `baseRequest({ signedIn })` requires it. The check script uses signed
    out.
  - Prompt additions beyond the plan, all from the live runs below: a
    question about the list isn't a save; the note replaces what earlier
    messages say and is never a reason to save; "always write one short line
    (e.g. "Added to your list.")" after a save; an error result → "couldn't
    be saved". The "don't ask clarifying questions" rule is now scoped to
    recommendations instead of naming an exception.
  - `MAX_LIST_CHANGES = 10` is in `chatLimits.ts` and exported from the chat
    index, for phase 5's client.
- **For the next phase:**
  - Send `listChanges` as `{ movieId, type }[]`, at most `MAX_LIST_CHANGES`;
    more, or a non-integer id, is a 400.
  - The note only says what the DB has now. It doesn't say *why* (Undo vs a
    save after sign-in); the prompt's example is Undo.
  - Live, a direct "add Fury (2014) to my list" sometimes calls a made-up
    `save_title_to_list` first. The registry rejects it as an unknown tool
    and the model retries with `save_to_list` in the next round. That costs
    one extra round, and the chat streams a `tool_start` for the unknown
    name. Phase 7 could check how that line looks.
- **Checks:**
  - `npm run lint`, `npx tsc --noEmit`, `npm run typecheck:tests` and
    `npm run test:run` (1072 tests) are green. `chat.spec.ts` (15) is green.
  - `npm run check:chat-tools` with the real key passed (both choices
    accepted, 10 tools).
  - Manual check with the real key: a throwaway script (deleted afterwards)
    called `streamChatReply` under Node, not the edge route, with a temp
    SQLite DB, real Gemini (`gemini-3.5-flash-lite`, minimal thinking) and
    real TMDB. The edge route can't be tried signed in locally: auth uses DB
    sessions, and the edge libsql client can't open a `file:` DB.
    - "add the second one to my watchlist" after Brad Pitt war cards →
      Inglourious Basterds (card 2) saved as Planning to watch, "Added to
      your list." **Passed.**
    - "mark Dune as completed" → searched, then asked "the 2021 film, the
      1984 film, or Dune: Part Two?"; "mark Dune (2021) as completed" →
      Completed, rating 9 kept. **Passed.**
    - signed out, "add Fury to my watchlist" → `sign_in_required` with
      status "Planning to watch" (the phase 3 gap is fixed), "Please sign
      in to add titles to your list." **Passed.**
    - unrelated question → the "recommendations and your list" line.
      **Passed.**
    - save, remove it as Undo would, then "is Fury in my list?" with
      `listChanges`: before the prompt fixes it **called `save_to_list`
      again** and re-added Fury. After them, 5 of 5 runs said it isn't in
      the list (one earlier wording got 1 of 2 wrong). Scenarios 1–3 ran
      before the last tweak of the note bullet, not after.

### Phase 5: Chat UI for list changes

- **Status:** done
- **Commits:** see `feat(chat): show list changes with undo in the chat` (this entry is in it)
- **Deviations from the plan:**
  - `useChat.undoSave` makes the request and resolves `false` on failure;
    `ListSavedRow` shows the error toast. A 200 `{ addToListResult: "fail" }`
    (the list routes' DB error) counts as a failure too.
  - Undo is hidden only in the streaming answer. Finished rows keep it while
    the next answer streams. So a completed turn clears only the
    `listChanges` objects it sent (`addListChange` re-adds a key as a new
    object), and a change made during the turn goes with the next one.
    The client keeps the newest `MAX_LIST_CHANGES`.
  - `router.refresh()` runs once at the end of a turn that had a
    `list_saved`: completed, failed, stopped or New chat. Not on
    `pagehide`/unmount: the next page loads fresh data anyway.
  - Card statuses: `listStatuses()` in `messageParts.ts`. `ChatAssistant`
    memoizes the map on its JSON, so it only changes with a save or Undo.
    It's passed down like `signedIn`, and each card gets only its own
    status. An undone change from a legacy status gives no badge (unknown).
  - `ListSavedRow` gets `onUndo` only on finished messages; no `onUndo` also
    means "streaming", which is when the row has `aria-live`.
  - Added TMDB's `w92` to `ImageSize` for the thumbnails (images are
    unoptimized, so `w342` would load 7x the pixels), and `isListStatus` to
    the my-list index (the storage check and `listStatuses` need it).
  - At 320 px the Undo button wraps below the row's text.
- **For the next phase:**
  - A resumed save renders with the same part: `addListSaved(parts,
    { entry, previous })`. Push the key with `addListChange` (in
    `useChat.ts`) before the `setMessages`, so the save effect stores it.
    New saved fields go in `snapshot()` in `useChat`, plus `SavedChat` and
    `isSavedChat`.
  - The sign-in card still shows in a restored chat after signing in, with
    a `/signin` link. Phase 6 replaces the link anyway.
  - `routeFetch` in `ChatAssistant.test.tsx` now records `method` and
    `headers`, and allows a request without a body.
  - Fixtures for list parts are in `chat/testing/listParts.ts`.
- **Checks:**
  - `npm run lint`, `npx tsc --noEmit`, `npm run typecheck:tests` and
    `npm run test:run` (1134 tests) are green. `chat.spec.ts` (15) is green.
  - The manual check was scripted: a throwaway Playwright spec (deleted
    afterwards) on the e2e server, with stubbed `list_saved` /
    `sign_in_required` events, at 1280 and 320 px. Screenshots were
    checked by eye: the rows (added, moved, already in the list, a long
    title), the badges, Undo → "Undone" and the badge gone, and one and
    three titles on the sign-in card. Nothing overflows at 320 px.
    Signed in with a seeded entry, Undo removed it from the real DB, and
    the next request carried `listChanges`. No real-key run in this phase.

### Phase 6: Sign-in round trip

- **Status:** done
- **Commits:** see `feat(chat): save the pending titles after sign-in` (this entry is in it)
- **Deviations from the plan:**
  - The card doesn't write `pendingSaves` to storage itself. It calls
    `startSignIn(saves)` from `useChat`, passed down like `onUndo`. That
    sets `pendingSavesRef` and saves the blob synchronously. `useChat`
    rewrites the whole blob from its refs on every save, so a direct write
    would be lost: e.g. a click mid-answer, then `pagehide` saves the
    stopped turn. `pendingSaves` is in `snapshot()`; `reset()` drops it.
  - `loadChat` leaves out pending saves older than
    `PENDING_SAVE_MAX_AGE_MS`. It doesn't rewrite storage; the next save
    drops them.
  - The provider buttons are one component, `shared/ui/SignInButtons`, used
    by the sign-in page and the card (`compact`). It takes the action as a
    prop: chat may only import account's index or `/actions`, and the index
    would be an import cycle (account → chat index → … → account), and
    `shared/` can't import modules. The card's buttons read "Google" /
    "GitHub", with `aria-label` "Sign in with …". The page now says
    "GitHub", not "Github"; `auth.spec.ts` matches names case-insensitively
    and needed no change. The icons are `aria-hidden` (the GitHub SVG's
    `<title>` was leaking into the button's name).
  - The "Other sign-in options" link also stores the pending saves, so
    signing in from `/signin` saves them too.
  - `signInWithProvider` throws `Unknown sign-in provider` for anything but
    `google` / `github`.
  - Route bodies: 401 `{ error: "signed_out" }`, 400 `invalid_request`, 422
    `{ error: <rejection reason> }`, 502 for a TMDB failure, **500** for
    anything else (e.g. the DB). It calls `revalidatePath("/my-list")` like
    the other list routes. The body schema is `titleToSaveInput` in
    `my-list/entryInput.ts`. It isn't strict: an extra `userId` is ignored.
  - The failure text is "Couldn't save Dune to your list. Ask me to add it
    again." The card's buttons would only sign in again, so "try again from
    the card" was misleading.
  - `SignInPage.test.tsx` now checks the props the page passes to
    `SignInButtons`. The redirect cases moved to `safeRedirect.test.ts`.
    The `signInWithProvider` tests are in `actions.int.test.ts`, because
    `actions.ts` imports the DB.
- **For the next phase:**
  - After the round trip, the old sign-in card still shows its provider
    buttons to the signed-in user. Clicking one runs OAuth again and resumes
    the same saves, which is harmless (a save without a status changes
    nothing). Phase 7 could hide the buttons when `signedIn`.
  - A New chat while the resumed saves are in flight still appends their
    rows, to the new chat. Not guarded.
  - E2E tip: `page.route("https://github.com/**", r => r.abort())` makes
    the navigation itself fail and races a following `page.goto("/")`.
    Fulfill it with a stub HTML page and `waitForURL(/github\.com/)`
    instead. The server action redirects to GitHub's authorize URL with
    `redirect_uri=http://localhost:3100/api/auth/callback/github`.
  - `tests/setup/components.tsx` mocks `signInWithProvider` too.
- **Checks:**
  - `npm run lint`, `npx tsc --noEmit`, `npm run typecheck:tests` and
    `npm run test:run` (1181 tests) are green.
  - `npx playwright test tests/e2e/chat.spec.ts tests/e2e/auth.spec.ts`
    (20) is green. `test:e2e:variants` wasn't run (not in this phase's
    checks).
  - Real OAuth wasn't tried: it needs a person to log in to Google or
    GitHub. Instead a throwaway Playwright spec (deleted afterwards) ran on
    the e2e server and passed twice in a row. Signed out, a stubbed
    `sign_in_required` showed the card. Clicking GitHub ran the real server
    action up to GitHub's authorize URL (stubbed). Then `loginAs` and
    `page.goto("/")` restored the chat, "Added to your list · Planning to
    watch" showed (real `/api/save-title`, mocked TMDB), the DB had the row
    with rating 0, a reload sent no second `PUT`, and `/my-list` listed the
    title. "Other sign-in options" kept the pending saves. Screenshots of
    the one- and three-title cards at 320 and 1280 px, the resumed row and
    `/signin` were checked by eye: nothing overflows, and the buttons wrap
    at 320 px.

### Phase 7: E2E, manual checks, cleanup

- **Status:** done with gaps (manual checks 3–7 not run: Gemini capacity and rate limits)
- **Commits:** `fix(chat): hide the sign-in card once the user is signed in`,
  `refactor(my-list): export only saveTitle for chat saves`, then
  `test(e2e): cover chat persistence and list changes` (this entry is in it)
- **Deviations from the plan:**
  - The new tests are in two files: `chat-session.spec.ts` (persistence,
    expired) and `chat-list.spec.ts` (rows, Undo, sign-in round trip,
    320 px). `send`, `promptInput`, `cards` and `card` moved from
    `chat.spec.ts` to `helpers/chat.ts`. `stubAssistant` takes `json` for a
    non-stream answer (the 409).
  - `/api/assistant` is stubbed, so a save "made by the model" is seeded in
    the DB before the stubbed `list_saved` event. Undo (both routes) and
    `/api/save-title` run for real against the e2e DB and the TMDB mock.
  - Phase 6's suggestion: the sign-in card isn't rendered once `signedIn`
    (`MessageParts`). After the round trip the model's "please sign in"
    line is followed by the resumed "Added" row, without provider buttons.
  - `getEntry` and `saveEntryStatus` are no longer exported from
    `my-list/server.ts`: only `saveTitle` uses them, and other modules
    should save through its title check.
  - The manual checks ran through a throwaway vitest config (real env, temp
    SQLite DB via `tests/setup/integration.ts`) calling `streamChatReply`,
    like phase 4. It was deleted afterwards.
- **For the next phase:** none (last phase). Left as is:
  - A New chat while resumed saves are in flight still appends their rows
    to the new chat (phase 6 note).
  - The unknown-tool line for a made-up `save_title_to_list` (phase 4 note)
    wasn't looked at: it needs a live run that happens to call it.
  - Live, the model answered "Added to your list." to a status change
    (Watching → Completed). The row underneath says "Moved to Completed",
    so it's only loose wording from the prompt's example.
- **Checks:**
  - `npm run lint`, `npx tsc --noEmit`, `npm run typecheck:tests` and
    `npm run test:run` (1181 tests) are green.
  - Default e2e run: 73 passed. `npm run test:e2e:variants`: 2 + 2 passed.
  - The new e2e tests were checked to fail when the behaviour breaks:
    without the sign-out `clearSavedChat`, and with the sign-in card shown
    to signed-in users.
  - `npm run check:chat-tools` with the real key passed (10 tools, both
    choices), after one 503 "high demand" retry.
  - Manual checks with the real key (`gemini-3.5-flash-lite`, minimal
    thinking, real TMDB):
    1. Brad Pitt war cards → "add the second one to my watchlist" →
       Inglourious Basterds (card 2) saved as Planning to watch, "Added to
       your list." **Passed.**
    2. Dune (2021) seeded as Watching, rating 9 → "mark Dune as completed"
       → asked "the 2021 film, the 2024 sequel, or the 1984 original?" (a
       second run: 2021 or 1984) → "the 2021 one" → Completed, rating 9
       kept. **Passed.**
    3. "add all of them" after 5 cards: **not run.** The first turn
       ("recommend 5 heist movies") timed out (`APIConnectionTimeoutError`,
       2 min abort) on 5 attempts while Gemini reported high demand; turns
       in 1 and 2 had the same timeout once and then went through. Then
       the key hit its rate limit.
    4. Signed out → sign-in → "add another one like it": **not run** (rate
       limit). The browser side is covered by the e2e round trip test.
    5. Undo, then "is it in my list?": **not run** (rate limit); phase 4
       passed it 5 of 5 against the same note.
    6. Refresh mid-answer: the browser side (stopped message, the
       follow-up's `stoppedTurns`) is covered by e2e; the model's
       continuation **not run** (rate limit).
    7. Expired conversation: **not run**; relies on phase 2's mock tests
       and its live check with a deleted interaction (same 404).
