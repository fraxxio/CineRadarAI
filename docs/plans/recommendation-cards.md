# Plan: recommendation cards in the AI chat

## Goal

Recommendations show as cards with real TMDB data (poster, title, year, type,
rating, genres, reason, link to the title page, "Add to list") instead of a
markdown list. The model picks the titles and writes the reasons. The server
gets every displayed field from TMDB, so a card can't show a made-up year,
rating or poster.

The feature is done when:

- recommendations show as cards with the right posters and data
- follow-ups like "more like the second one" still work
- cards work on mobile widths (320–480 px)

## How to work on this plan

The work is split into **4 phases**, run **one after another**. Each phase is
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
5. **Commit messages:** a single conventional-commit title line, like the
   history (e.g. `feat(chat): add show_recommendations tool`). No body, no
   co-author trailer.
6. **Each phase leaves the app working.** Until phase 3 the model still
   answers with markdown lists, and the new code is present but unused.

| Phase | Scope | Depends on |
|---|---|---|
| 1 | Card UI: data type and card components, standalone | none |
| 2 | Chat client: `cards` event, message part, `useChat`, rendering, `signedIn` | 1 |
| 3 | Server and prompt: `show_recommendations`, the round loop and the new prompt | 2 |
| 4 | E2E, mobile checks, manual checks with a real key, cleanup | 3 |

## Decisions

| Topic | Decision |
|---|---|
| How cards are produced | New tool `show_recommendations({ items: [{ type, id, reason }] })`. The server checks each id with TMDB (`getTitle`), drops the invalid ones and streams the rest as one `cards` event. |
| What the model gets back | Short JSON: the titles that were shown, with their position (`1`, `2`, …), and the ids that were left out, with a reason. No poster paths, which keeps tokens low. This result stays in Gemini's interaction history, which is how "the second one" works. |
| What the client gets | `{ type: "cards", items: RecommendedTitle[] }` with everything a card needs. It sends paths, not URLs, like the rest of `@/infra/tmdb`. |
| Message model | `ChatMessage.parts` already exists (`text`, `tool`). Add a third part, `{ type: "cards", items }`. Parts keep arrival order: intro text → tool lines → cards → optional closing line. |
| Tool line | `show_recommendations` gets a normal tool line ("Preparing recommendations..."), and it stays in the history. The client needs no special case. (Chosen by the user.) |
| Card layout | Compact rows: a small 2:3 poster on the left, details and reason on the right. 1 column on mobile, 2 from `lg`. (Chosen by the user.) |
| Add to list | `ListEntryDialog mode="add"` in the card corner, as in `MovieCard`. It uses the existing `PUT /api/add-to-list`. `image` = `backdropPath \|\| posterPath \|\| ""`, as in `MovieCard` and `Details`. No AI involved. |
| Signed-in state | `src/app/page.tsx` calls `getSession()`, which is cached and already called by the layout. It passes `signedIn` down as props: `ChatAssistant → AssistantMessage → MessageParts → RecommendationCards`. This is the same pattern as `SearchResults → MovieCard`. |
| Round cap | Today, request #`MAX_TOOL_ROUNDS` sends `tool_choice: "none"`, so a model that researched for 4 rounds could never show cards. That request now allows **only** `show_recommendations` (`allowed_tools`, mode `auto`). After a round that showed cards, the next request always sends `"none"`. |
| Failed tools / TMDB down | Remove the old `/search?query=…` fallback links. The prompt tells the model to say briefly that titles can't be looked up right now, and to recommend no titles from memory. |
| Stopped turn after cards | The stopped message keeps its cards part, because `stop()` already stores `turn.parts`. `partsToText` renders the cards as a one-line bracketed note, so the model knows what the user saw. |
| Markdown in text parts | Keep `react-markdown` and the link component in `MessageParts.tsx`. Intro and closing lines are still text, and keeping the link handling is the safe default. |

## Architecture

```
src/infra/tmdb/
  server.ts        getTitle(type, id, options?)        ← phase 3: FetchOptions (signal)
  urls.ts          ImageSize + "w342"                  ← phase 1

src/modules/chat/
  protocol.ts      + RecommendedTitle (1), cards event + CardsPart (2)
  index.ts         + export RecommendedTitle (1), CardsPart (2)
  RecommendationCards.tsx / RecommendationCard.tsx   NEW (1)
  messageParts.ts  + addCards, partsToText(cards), startTool block fix,
                   lastPartIsFinishedTool → isWaitingForModel (2)
  useChat.ts       + case "cards" (2)
  MessageParts.tsx / AssistantMessage.tsx / ChatAssistant.tsx  + signedIn (2)
  tools/types.ts   + CardsOutput, ToolResult.cards? (3)
  tools/registry.ts + showRecommendations, unwrap CardsOutput (3)
  tools/showRecommendations.ts  NEW (3)
  llm/llmService.ts + cards events, tool choice per round (3)
  chatConfig.ts    prompt: cards instead of the markdown list (3)

src/app/page.tsx   async, reads the session, passes signedIn (2)
scripts/check-chat-tools.ts  + second request with DISPLAY_ONLY_TOOL_CHOICE (3)
tests/e2e/chat.spec.ts       cards, mobile, add to list (4)
```

---

## Phase 1: Card UI

**Goal:** the card components exist and are tested on their own. Nothing in
the chat renders them yet.

### 1.1 `RecommendedTitle` (`protocol.ts`)

```ts
import type { MediaType } from "@/infra/tmdb";

// one recommendation card; every field except `reason` comes from TMDB
export type RecommendedTitle = {
  type: MediaType;
  id: number;
  title: string;
  // null when TMDB has no date
  year: number | null;
  // vote average to 1 decimal; null when nobody voted
  rating: number | null;
  genres: string[];
  posterPath: string | null;
  // what "Add to list" saves, like the search cards
  backdropPath: string | null;
  // the model's one sentence on why it fits
  reason: string;
};
```

- Export the type from `index.ts`.
- Use `import type` only: the e2e helpers import this module's types.

### 1.2 Image size (`infra/tmdb/urls.ts`)

Add `"w342"` (a real TMDB size) to `ImageSize`. Ten cards then don't download
w500 posters for a 96 px slot. Update `urls.test.ts` if it pins the sizes.

### 1.3 `RecommendationCards.tsx` / `RecommendationCard.tsx` (new, in `src/modules/chat/`)

Props: `RecommendationCards({ items, signedIn })` and
`RecommendationCard({ title: RecommendedTitle, signedIn })`. Name the props as
you see fit.

The list:

```tsx
<ul aria-label="Recommendations" className="grid grid-cols-1 gap-3 py-2 lg:grid-cols-2">
  {items.map((item) => (
    // movie and TV ids can collide
    <li key={`${item.type}-${item.id}`}><RecommendationCard … /></li>
  ))}
</ul>
```

One card. It matches `MovieCard` (border, hover glow, corner add button) and
`ListCard` (horizontal row, `ImageOff` placeholder, title link):

```
relative flex h-full border border-border-clr bg-primary-bg duration-300
hover:border-primary-text hover:shadow-md hover:shadow-primary-text
├─ <Link href={href} tabIndex={-1} aria-hidden className="w-24 shrink-0 max-[380px]:w-20">
│    poster: tmdbImageUrl(posterPath || backdropPath, "w342")
│      <Image width={96} height={144} sizes="96px" alt={title}
│             className="aspect-[2/3] h-full w-full border-r border-border-clr object-cover" />
│    or a placeholder of the same size: ImageOff aria-label="No image available" on bg-slate-950
├─ <div className="flex min-w-0 flex-col gap-1 p-3 pr-14">
│    <h3><Link href={href} className="text-lg font-medium hover:underline">{title}</Link></h3>
│    <p className="text-sm text-secondary-text">{year ?? "Unknown year"} · {type === "movie" ? "Movie" : "TV show"}</p>
│    <p className="flex items-center gap-1 text-sm"><Star size={16} /> {rating === null ? "Not rated" : `${rating.toFixed(1)} / 10`}</p>
│    {genres.length > 0 && <p className="text-sm">{genres.join(" · ")}</p>}
│    <p className="break-words">{reason}</p>
└─ <ListEntryDialog mode="add" signedIn={signedIn} movieId={id} title={title}
                    image={backdropPath || posterPath || ""} type={type} />
```

- `href = /search/${type}/${id}`.
- The poster link is `aria-hidden` / `tabIndex={-1}`, so screen readers and
  keyboard users get one link per card: the title.
- `pr-14` keeps the title clear of the corner button. `min-w-0` and
  `break-words` stop long titles or reasons from widening the chat on mobile.
- Both files get rendered from the client chat tree. Don't add
  `"use client"`: `ListEntryDialog` already has it.
- Import `ListEntryDialog` from `@/modules/my-list`, as search does.

### Tests

First read how `MovieCard.test.tsx`, `ListEntryDialog.test.tsx` and
`my-list/testing/listForm.tsx` drive the dialog.

`RecommendationCard.test.tsx`:

- the poster `img` has the w342 URL, and its `alt` is the title
- with no poster and no backdrop, the "No image available" placeholder shows
- the title link goes to `/search/movie/550`, and a TV card's to
  `/search/tv/1399`
- the type shows as "Movie" or "TV show"
- the rating shows as "7.5 / 10" or "Not rated"
- genres are joined, and the reason shows
- a missing year shows "Unknown year"
- signed in: "Add to list" → choose a status → `PUT /api/add-to-list` with
  `{ movieId: "550", title, image: backdropPath, type: "movie", status,
  rating: "" }`. With `backdropPath: null` it sends the poster path.
- signed out: a warning toast shows, and nothing is fetched

`RecommendationCards.test.tsx` (or the same file): one `listitem` per item, in
order, inside a list named "Recommendations".

### Done when

- `npm run lint`, `npm run test:run` and `npm run typecheck:tests` are green.
- `npx tsc --noEmit` is clean (or the repo's usual type check).
- Commit: `feat(chat): add recommendation card components`

---

## Phase 2: Chat client

**Goal:** the client handles a `cards` event end to end: it streams, renders,
stops, keeps history and shares the cards with the model after a stop. The
server doesn't send cards yet, so tests use hand-written events.

### 2.1 Protocol (`protocol.ts`, `index.ts`)

- `ChatStreamEvent` gets `| { type: "cards"; items: RecommendedTitle[] }`,
  with the comment "a show_recommendations call finished; only the titles
  TMDB confirmed, in the model's order".
- Add `export type CardsPart = { type: "cards"; items: RecommendedTitle[] };`
  and `MessagePart = TextPart | ToolPart | CardsPart`. Remove the
  `// future: … titles` comment.
- Export `CardsPart` from `index.ts`.

### 2.2 `messageParts.ts`

- `addCards(parts, items)` appends `{ type: "cards", items }`. It's pure,
  like the others.
- `startTool`: the tool block starts after the last **non-tool** part
  (`findLastIndex(part => part.type !== "tool") + 1`), so cards also end a
  block. Update the comment.
- `partsToText`: add `case "cards"`, which pushes one bracketed line:
  `[Shown as cards: 1. Fury (movie 228150, 2014); 2. Dunkirk (movie 374720, 2017)]`.
  Use `year ?? "unknown year"`. Leave the reasons out: the model wrote them,
  and without them the note stays short and doesn't look like a list the
  model might copy. Keep the `satisfies never` default.
- Replace `lastPartIsFinishedTool` with `isWaitingForModel(parts)`. It's true
  when the parts are empty, the last part is a finished tool line, or the
  last part is cards. In each case the model is still working on its next
  round.

### 2.3 `useChat.ts`

```ts
case "cards":
  turn.parts = addCards(turn.parts, serverEvent.items);
  setStreamingParts(turn.parts);
  break;
```

Nothing else changes:

- `stop()` already stores `turn.parts`, so a stopped message keeps its cards.
- `partsToText` now shares the cards with the model.
- `done` moves them into the history.
- `error` drops the partial answer, as it already does for tool rounds.

### 2.4 Rendering and `signedIn`

- `MessageParts` gets `signedIn: boolean` and
  `case "cards": return <RecommendationCards items={part.items} signedIn={signedIn} />;`.
- `AssistantMessage` gets `signedIn: boolean` and passes it on. Make it
  **required**: if it were optional, forgetting it on the history message
  would tell signed-in users to log in.
- `ChatAssistant` gets `signedIn: boolean` and passes it to every
  `AssistantMessage`. It also computes
  `showLoader = isWaitingForModel(streamingParts)`; update the comment there.
- `src/app/page.tsx` becomes `async` and computes
  `const signedIn = (await getSession())?.user !== undefined;`. Pass it to
  all three `ChatAssistant` renders, including the disabled "out of order"
  overlay.

### Tests

`ChatAssistant.test.tsx` tests `useChat` through the component. Use
`routeFetch`, `controlledStream` and `ndjson`. Add `signedIn` to `renderChat`,
a `cards(items)` event builder and a `card(id, extra)` item builder.

- cards render live in the streaming answer and stay after `done`
- DOM order: intro text → tool line → cards → closing text
- the loader shows after the cards until the next delta
- stop after cards: the message keeps the cards and the "Stopped" label. The
  next request's `stoppedTurns[0].partialText` equals
  `"Intro.\n\n[Shown as cards: 1. …]"`.
- stop before cards: no cards in the history
- an error after cards drops the answer (the current behaviour, pinned)
- cards of earlier answers stay while the next turn streams
- the signed-in flag reaches the card: "Add to list" + submit calls
  `/api/add-to-list` and doesn't show the login toast

`messageParts.test.ts`:

- `addCards` appends and doesn't change its input
- `startTool` after cards starts a new line
- `partsToText` renders text and cards in order, in the bracketed format
- `isWaitingForModel` for empty parts, a running tool, a finished tool,
  cards and text
- remove the `lastPartIsFinishedTool` tests

`AssistantMessage.test.tsx`: update for the new prop.

`HomePage.test.tsx` currently calls `render(Home({ searchParams }))`
synchronously. Change it to `render(await Home(...))` and mock
`@/infra/auth/session` (`getSession`), so the test doesn't pull in real
auth. Add a case for each value: signed in passes `signedIn` = true to the
chat, signed out passes false.

### Done when

- `npm run lint`, `npm run test:run` and `npm run typecheck:tests` are green.
- `npx tsc --noEmit` is clean.
- `npx playwright test tests/e2e/chat.spec.ts` is still green: nothing
  visible changed yet.
- Commit(s), for example:
  - `feat(chat): add cards to the stream protocol and message parts`
  - `feat(chat): render recommendation cards in chat messages`

---

## Phase 3: Server and prompt

**Goal:** the model shows recommendations with `show_recommendations`, and
the server checks them with TMDB and streams `cards`. After this phase the
feature works end to end.

The tool and the prompt change go in the **same phase** because
`chatConfig.test.ts` ("names every tool") fails as soon as the tool is
registered and the prompt doesn't name it.

### 3.1 `getTitle` takes a signal (`infra/tmdb/server.ts`)

Change it to `getTitle(type, id, options?: FetchOptions)` and pass the
options to `tmdbFetch`. The existing callers (the details pages and
`Details.tsx`) don't change.

### 3.2 Tool output with cards (`tools/types.ts`)

Follow the `ToolError` pattern: a class the registry recognises with
`instanceof`.

```ts
// returned by a display tool: the model gets `output`, the chat shows `cards`
export class CardsOutput {
  constructor(
    readonly output: object,
    readonly cards: RecommendedTitle[],
  ) {}
}
```

- `ToolResult` gets `cards?: RecommendedTitle[]`. It's set only for a
  successful `CardsOutput`.
- `ChatTool.run` keeps `Promise<object>` (a `CardsOutput` is an object).
  Change its comment to "short JSON for the model, or a CardsOutput".
- The lookup tools don't change.

### 3.3 Registry (`tools/registry.ts`)

- Add `showRecommendations` as the **last** entry of `CHAT_TOOLS`.
- In `runToolCall`, unwrap the class:

```ts
const value = await tool.run(args.value, { signal: timeout.signal });
return value instanceof CardsOutput
  ? { callId: call.id, name: call.name, output: value.output, cards: value.cards, isError: false }
  : { callId: call.id, name: call.name, output: value, isError: false };
```

- `toFunctionResults` (`llm/geminiTools.ts`) already sends only `output`, so
  cards never reach the model. Pin that with a test.
- Update the `MAX_CALLS_PER_ROUND` comment, which currently says "10
  recommendations max, one call each". Recommendations no longer take one
  call each. Keep the value.

### 3.4 `tools/showRecommendations.ts` (new)

```ts
export const SHOW_RECOMMENDATIONS = "show_recommendations";
const MAX_ITEMS = 10;
const MAX_REASON_LENGTH = 200;
```

- **description:** "Show the recommended titles to the user as cards with
  poster, year, rating and genres from TMDB. This is the only way to show
  recommendations: call it once per answer with every title, in the order
  you recommend them. Returns the titles shown, with their position, and the
  ones left out."
- **status:** `"Preparing recommendations..."`
- **args:** a `z.object` with `items`, a
  `z.array(z.object({ type: mediaTypeArg, id, reason }))` with
  `.min(1).max(MAX_ITEMS)`:
  - `id`: `z.number().int().min(1).describe("TMDB id of the title, exactly as a tool returned it in this conversation")`
  - `reason`: `z.string().min(1).max(MAX_REASON_LENGTH).describe("One sentence on why it fits, in the user's language")`
  - Use only keywords in `ALLOWED_SCHEMA_KEYWORDS`. All of the above are
    already allowed.
- **run:**
  1. Remove repeated `type`+`id` pairs and keep the first. Report the
     repeats in `notShown` with the reason `"listed twice"`.
  2. Run `Promise.allSettled(unique.map(item => getTitle(item.type, item.id,
     { signal })))`. If `signal.aborted`, throw `signal.reason` (as
     `runToolCalls` expects).
  3. Handle each result, in arg order:
     - rejected with a `TmdbError` with status 404: put it in `notShown`
       with `"not found on TMDB"`
     - rejected for any other reason: `notShown` with
       `"couldn't be checked"`
     - fulfilled but not released (`releaseDate === ""` or after `today()`):
       `notShown` with `"not released yet"`. This enforces the prompt's
       released-only rule.
     - otherwise, make a card:
       - `title`
       - `year: yearOf(releaseDate)`
       - `rating: voteCount ? roundRating(voteAverage) : null`
       - `genres: genres.map(g => g.name)`
       - `posterPath`, `backdropPath`
       - `reason` from the args
  4. If no card was made and **every** lookup failed with a non-404 error,
     throw the first error. The registry turns it into "TMDB request failed
     (status …)" or "timed out", as for the other tools.
  5. Otherwise return `new CardsOutput(modelOutput, cards)`, where:

```ts
modelOutput = {
  // what the user sees, in order: "the second one" is position 2
  shown: cards.map((c, i) => ({ position: i + 1, id: c.id, type: c.type, title: c.title, year: c.year })),
  notShown: [{ id, type, reason }],
};
```

  This includes the case where no card was made only because of 404s: return
  `cards: []`. No cards event is sent (3.5), and the model can search again.
- Reuse `yearOf`, `roundRating` and `mediaTypeArg` from `tools/shared.ts`,
  and `today` from `../date`. If a shared `isReleased(date, asOf)` reads
  better, extract it from `isListable` in `shared.ts` and use it in both
  places.

### 3.5 Round loop (`llm/llmService.ts`)

```ts
// the last tool round may only show the cards
export const DISPLAY_ONLY_TOOL_CHOICE: Interactions.ToolChoiceConfig = {
  allowed_tools: { mode: "auto", tools: [SHOW_RECOMMENDATIONS] },
};
```

- `RoundRequest.toolChoice` becomes
  `Interactions.ToolChoiceConfig | Interactions.ToolChoiceType`.
- Use mode `auto`, not `any`: the model can still answer with text, for
  example to an off-topic message or when nothing matched.

In `runTurn`, after `readRound`:

```
if completed → done
if status/calls invalid → error (unchanged)
// round MAX_TOOL_ROUNDS was sent DISPLAY_ONLY, later rounds "none"
if round > MAX_TOOL_ROUNDS
   or (round === MAX_TOOL_ROUNDS and some call isn't show_recommendations)
   → console.error(`Gemini still wants tools after ${MAX_TOOL_ROUNDS} rounds`), error
results = await runToolCalls(...)
log line (unchanged), tool_end per call (unchanged)
for each result with cards.length > 0 → yield { type: "cards", items: result.cards }
shownCards = any result had cards.length > 0
toolChoice =
  shownCards || round >= MAX_TOOL_ROUNDS ? "none"
  : round + 1 >= MAX_TOOL_ROUNDS ? DISPLAY_ONLY_TOOL_CHOICE
  : "auto"
```

- Yield `cards` **after** the round's `tool_end` events. The tool line
  pauses and the cards appear right below it.
- Lookup calls in the same round as `show_recommendations` still run, which
  is harmless.
- Two `show_recommendations` calls in one turn give two cards parts. The
  prompt asks for one call, so don't add a guard.
- Put the choice in a small pure helper (`nextToolChoice(round, shownCards)`)
  and test it through the route.

### 3.6 Live check (`scripts/check-chat-tools.ts`)

After the existing request, send a second one with
`tool_choice: DISPLAY_ONLY_TOOL_CHOICE`. If Gemini rejects `allowed_tools`,
this check shows it before production does. Update the header comment: the
check should now also be run after tool-choice changes.

### 3.7 Prompt (`chatConfig.ts`)

Rewrite only what the cards change. The tool-routing bullets, the rules and
the date handling stay.

**# Tools:**

- First bullet: "Recommend only titles a tool returned in this conversation.
  Check any title you think of yourself with search_titles first." Drop the
  "(the one exception, failed tool calls, …)" part.
- Replace "Use the title, year, genres and rating exactly as the tools return
  them. If you mention a rating…" with "Don't write years, ratings or genres
  in text: the cards show them from TMDB."
- Keep the "TMDB id exactly as the tools return it" bullet. It now matters
  for show_recommendations.

**# Rules:** "Never list the same TMDB id twice" becomes "Never pass the same
TMDB id twice to show_recommendations. The same film under another name
counts once (…)".

**# Output format** (replace the whole section):

- Reply in the user's language. Keep titles in their English form, as TMDB
  returns them.
- Show recommendations only with show_recommendations: one call with every
  title, in the order you recommend them, each with a one-sentence reason.
  Never write recommendations in text, as a list or in sentences.
- Before that call, write one short intro sentence without naming titles.
  After it, write nothing, except one short line on how to narrow it down
  when the request was vague. No closing summary.
- Give 5 recommendations by default. Give more or fewer if the user asks, up
  to 10.
- If show_recommendations left titles out, don't mention them. If it showed
  none, look for other titles.
- The user sees the cards in the order show_recommendations returned them:
  "the second one" means position 2 of the latest cards.
- If the tool calls failed (error results), say in one short line that you
  can't look titles up right now and the user should try again later. Don't
  recommend titles from memory.

**# Example** (keep the real ids; the tests use them):

```
User: war movies with Brad Pitt
(search_person returned Brad Pitt with id 287; discover_titles with withCast [287] and genres ["War"] returned Fury with id 228150 and Inglourious Basterds with id 16869)
Assistant: Here are some war films featuring Brad Pitt.
show_recommendations({"items":[{"type":"movie","id":228150,"reason":"A tense WWII tank-crew drama with Pitt as a battle-hardened sergeant."},{"type":"movie","id":16869,"reason":"Tarantino's darkly comic WWII revenge story with Pitt leading a Jewish-American squad."}]})
```

The "If you write anything before calling tools, keep it to one short line"
bullet stays: it covers the research rounds.

### Tests

Add a `rawDetails(id, extra)` builder to `testing/tmdbData.ts` for
`/movie/{id}` and `/tv/{id}` responses (with `genres: [{id, name}]`).

**Unit**

`tools/showRecommendations.test.ts`:

- cards come in arg order, with TMDB's title/year/rating/genres/poster/
  backdrop and the arg's reason
- a 404 goes to `notShown` and makes no card
- an unreleased title goes to `notShown`
- duplicates go to `notShown` as `"listed twice"`
- 0 votes gives `rating: null`
- when every lookup gets a 5xx, it throws a `TmdbError`
- some 404s and no cards: a `CardsOutput` with `cards: []`
- the model output has no poster or backdrop paths
- the signal reaches fetch, and an abort rethrows

`tools/registry.test.ts`:

- add `show_recommendations` to the `CHAT_TOOLS` pin and to the
  generated-schema pin
- a `CardsOutput` becomes `{ output, cards }`, and plain outputs have no
  `cards` key
- the keyword allowlist test covers the new schema automatically

`llm/geminiTools.test.ts`: a result with cards sends only `output`.

`chatConfig.test.ts`:

- remove the three link-format tests
- add: the prompt has no `](/search` links and no `/search?query=`
- it names `show_recommendations`
- it says never to write recommendations in text
- the example's ids are 228150 and 16869
- "names every tool" now covers the new tool

**Integration** (`assistant.route.int.test.ts`, `describe("tool loop")`):

- a `show_recommendations` round streams `tool_start` → `tool_end` → `cards`,
  with full `RecommendedTitle` items from the TMDB mock. The next request
  has `tool_choice: "none"`, and its `function_result` has `shown` /
  `notShown` and no `posterPath`.
- all ids 404 → no `cards` event, and the next request is `"auto"`
- round cap: update the existing test so the tool choices are
  `["auto", "auto", "auto", "auto", DISPLAY_ONLY_TOOL_CHOICE]`
- a `show_recommendations` call in round `MAX_TOOL_ROUNDS` runs, and the next
  request is `"none"`
- a lookup call in round `MAX_TOOL_ROUNDS` gives an error line and the
  existing log message
- the existing "calls despite tool_choice none" test still holds for round
  `MAX_TOOL_ROUNDS + 1`

### Done when

- `npm run lint`, `npm run test:run` and `npm run typecheck:tests` are green.
- `npx tsc --noEmit` is clean.
- `npx playwright test tests/e2e/chat.spec.ts` is green. It stubs
  `/api/assistant`, so it shouldn't change.
- `npm run check:chat-tools` passes both requests. This needs a real
  `GEMINI_API_KEY`. If it isn't available, run `-- --dry-run`, mark the
  phase `done with gaps`, and tell phase 4 to run the live check.
- Commit(s), for example:
  - `feat(chat): add show_recommendations tool`
  - `feat(chat): stream cards and reserve the last tool round for them`
  - `feat(chat): prompt the model to show recommendations as cards`

---

## Phase 4: E2E, mobile and manual checks

**Goal:** prove the "done when" items in a real browser and with the real
model, then clean up.

### E2E (`tests/e2e/chat.spec.ts`)

`stubAssistant` / `openAssistantStream` already answer with any
`ChatStreamEvent[]`, and `fixtures.ts` routes TMDB images to `pixel.png`.

- Replace "a recommendation link opens the title page" and "a fallback link
  opens the prefilled search" with:
  - a turn with a `cards` event shows the poster, title, year, rating and
    genres
  - clicking the title of movie 550 opens `/search/movie/550` (the TMDB mock
    has that fixture)
- Mobile: use `test.use({ viewport: { width: 375, height: 800 } })` or
  `setViewportSize`, and check:
  - the cards are visible
  - "Add to list" is inside the viewport
  - the messages container has no horizontal overflow
    (`scrollWidth <= clientWidth`)

  Repeat at 320 px.
- Signed in (`loginAs`, see `my-list.spec.ts`): "Add to list" on a card puts
  the entry in the DB.
- Signed out: "Add to list" shows the "You need to be logged in!" toast.
- `answerItem` selects the `listitem`s in `main`, so it now matches cards
  too. Scope the markdown tests' locator to text, or rewrite them, so it
  isn't ambiguous. Update the `FURY` / `FALLBACK` constants that no longer
  match what the app produces.
- "Stop keeps the turn": add a case that stops after a `cards` event and
  checks the shared `partialText`.
- Run `npm run test:e2e:variants` as well. The chat-disabled variant renders
  `ChatAssistant` with the new prop.

### Manual checks with a real key (can't be mocked)

- `npm run check:chat-tools`: both requests are accepted. Run it here if
  phase 3 couldn't.
- "war movies with Brad Pitt": a short intro, the "Preparing
  recommendations..." line, about 5 cards with the right posters, and no
  markdown list.
- Follow-up "more like the second one": the model uses position 2's id
  (watch the server log for `get_recommendations`/`get_similar` with that
  id) and shows new cards without repeating the earlier ones.
- "only TV shows" and "from the 90s": the refinements work.
- Stop right after the cards appear, then send "more like the first one":
  the answer builds on the stopped turn's first card.
- A vague prompt ("something fun"): cards plus one short narrowing line.
- An off-topic prompt: text only, no cards.
- On a phone width in DevTools (320 / 375 / 414 px): the layout holds, and
  the dialog opens and saves.

If the model keeps writing lists in text or misreads positions, tune the
prompt (3.7) in this phase. Write in the log which change fixed it.

### Cleanup

- Remove anything that became unused, such as e2e constants and helpers for
  markdown links. Search for `lastPartIsFinishedTool` and `/search?query=` in
  the chat module and tests.
- Check that no docs or comments still describe the markdown list format
  (`grep -rn "Markdown list\|numbered" src/modules/chat`).

### Done when

- All unit, integration and component tests are green, and both e2e runs
  (default and variants) are green.
- Every manual check above has a result in the log: passed, failed (with
  what happened) or not run (with why).
- Commit, for example: `test(e2e): cover recommendation cards on desktop and mobile`

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

### Phase 1: Card UI

- **Status:** done
- **Commits:** feat(chat): add recommendation card components (this commit; it
  also adds this plan file, which wasn't tracked before)
- **Deviations from the plan:** none. Components are named exports
  (`RecommendationCards`, `RecommendationCard`), like the other chat
  components except `ChatAssistant`. They aren't exported from `index.ts`:
  only `MessageParts` needs them.
- **For the next phase:** `RecommendationCard` takes `title: RecommendedTitle`
  and `signedIn`. In the DOM the "Add to list" button comes after the text, so
  the tab order is title link → button. The poster link is `aria-hidden`, so
  `getByRole("link")` inside a card finds only the title.
- **Checks:** `npm run lint`, `npx tsc --noEmit`, `npm run typecheck:tests`
  and `npm run test:run` (69 files, 866 tests) all green. E2E not run (not
  part of this phase's checks; nothing renders the cards yet).

### Phase 2: Chat client

- **Status:** done
- **Commits:** feat(chat): stream and render recommendation cards in chat
  messages (this commit)
- **Deviations from the plan:** one commit instead of two. Splitting
  protocol/`useChat` from rendering leaves the first commit failing the type
  check (`MessagePartView`'s `satisfies never` needs the `cards` case).
  `HomePage.test.tsx` doesn't add its own `getSession` mock: it is already
  mocked for every test in `tests/setup/shared.ts` (resolves `null`), so the
  signed-in cases use `mockResolvedValueOnce(makeSession())`. The test wraps
  the real `ChatAssistant` in `vi.fn` to read the `signedIn` prop. I also
  added an `AssistantMessage` test for text → tool → cards → text order.
- **For the next phase:** two `cards` events in one turn give two separate
  `Recommendations` lists (no merge), and a tool call after cards starts a new
  tool line. A stopped turn's `partialText` for cards is
  `[Shown as cards: 1. Fury (movie 228150, 2014); …]` (no reasons).
  `ChatAssistant.test.tsx` has `card(id, extra)`, `cards(items)` and
  `showStart(id)` builders; reuse them.
- **Checks:** `npm run lint`, `npx tsc --noEmit`, `npm run typecheck:tests`
  and `npm run test:run` (69 files, 890 tests) green.
  `npx playwright test tests/e2e/chat.spec.ts` green (11 tests).
  `npm run test:e2e:variants` green too (chat-disabled and recaptcha), though
  that's a phase 4 check.

### Phase 3: Server and prompt

- **Status:** done
- **Commits:** 6fc1674 feat(chat): add show_recommendations tool; feat(chat):
  stream cards and prompt the model to show them (this commit)
- **Deviations from the plan:**
  - `DISPLAY_ONLY_TOOL_CHOICE` uses mode **`validated`**, not `auto`. The
    live check failed with `400 allowed_tools mode must be either ANY or
    VALIDATED`, though the Interactions API reference lists `auto`.
    `validated` limits calls to the listed tools and still allows a text
    answer. The live check confirmed that: the display-only request ended
    `completed` with a text reply.
  - Two commits instead of three. Registering the tool without the round loop
    and the prompt would break `chatConfig.test.ts` and the app.
  - `check-chat-tools.ts` now also prints each request's status
    (`completed` = text, `requires_action` = tool call).
  - `notShown` lists the "listed twice" entries first, then the failed
    lookups in arg order.
- **For the next phase:**
  - The registry's `.strict()` applies only to the top-level args. Unknown
    keys inside an item (e.g. a `title` the model adds) are dropped silently,
    not rejected.
  - A `show_recommendations` call in round `MAX_TOOL_ROUNDS` runs as tool
    round 5, so the server log can show "Tool round 5: show_recommendations".
  - `getTitle` details have no `adult` flag, so the tool checks only the
    release date, not adult content.
  - `npx prettier --check src/modules/chat` warns about
    `ChatAssistant.test.tsx`, `messageParts.test.ts` and `genres.test.ts`.
    The warnings were already there before this phase; I left those files
    alone.
  - The live check passed here. Re-run it if phase 4 changes the tool args
    or the tool choice.
- **Checks:** `npm run lint`, `npx tsc --noEmit`, `npm run typecheck:tests`
  and `npm run test:run` (70 files, 910 tests) green.
  `npx playwright test tests/e2e/chat.spec.ts` green (11 tests).
  `npm run check:chat-tools` green with the real key: both requests accepted
  (`auto` → completed, display only → completed). The first commit was
  checked on its own (tsc, typecheck:tests, lint, chat module tests green).
