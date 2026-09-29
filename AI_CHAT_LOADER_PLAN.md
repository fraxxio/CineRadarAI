# Plan: animated "thinking" loader for the AI chat

Goal: while the AI chat waits for a response, show an animated loader in the chat instead of static italic text. Each letter of the loader word bounces in turn, from the first letter to the last. The word changes on a timer, and the order of the words is shuffled at random once per session (one page load of the chat).

Stack: Next.js 14.1.3 App Router, React 18, Tailwind 3, `react-markdown` 8. There are no tests in the repo.

---

## 1. Current behaviour

| Concern | Today | Where |
|---|---|---|
| Placeholder state | `streamingMessage` starts as `{ role: "assistant", content: "_Thinking..._" }` | [ChatAssistant.tsx:24-27](src/Components/ChatAssistant.tsx#L24-L27) |
| On submit | Placeholder is set to `"_Generating list..._"`. The user never sees the initial `_Thinking..._`. | [ChatAssistant.tsx:77-80](src/Components/ChatAssistant.tsx#L77-L80) |
| On first `delta` event | The streamed text replaces the placeholder | [ChatAssistant.tsx:130-137](src/Components/ChatAssistant.tsx#L130-L137) |
| Render | `{isLoading && <AssistantMessage message={streamingMessage} />}` | [ChatAssistant.tsx:219](src/Components/ChatAssistant.tsx#L219) |
| Message layout | Avatar and role header, then the content rendered by `<Markdown>` | [AssistantMessage.tsx](src/Components/ui/AssistantMessage.tsx) |
| When `isLoading` turns on | Before reCAPTCHA verification when reCAPTCHA is enabled, otherwise immediately | [ChatAssistant.tsx:43-75](src/Components/ChatAssistant.tsx#L43-L75) |

The loader must therefore show from `isLoading === true` until the first non-empty `delta` arrives. After that, the streamed Markdown takes its place, as it does now.

---

## 2. Behaviour to implement

1. **Letter-by-letter bounce.** The word is split into one `<span>` per character, including the trailing `...`. Every letter runs the same keyframe, delayed by `index * STEP`. The result is a wave that runs from the first letter to the last, pauses briefly, and repeats.
2. **Word rotation.** A fixed list of short, film-themed words. While one response is loading, the word changes every 2 waves. Because each new word is re-keyed, its wave starts again from the first letter.
3. **Random per session.** The word list is shuffled once, when `ChatAssistant` mounts. Each response starts at the next word in that shuffled order rather than going back to the first, so consecutive responses in a session don't open with the same word.
4. **Reduced motion.** When `prefers-reduced-motion` is set, letters don't move (`motion-reduce:animate-none`). The words still rotate.
5. **Accessibility.** The container has `role="status"` and a constant `aria-label="Generating response"`. Individual letters are `aria-hidden`, so screen readers don't spell out or announce each word change.

---

## 3. Implementation

### 3.1 Tailwind keyframe ([tailwind.config.ts](tailwind.config.ts))

Add the following under `theme.extend`:

```ts
keyframes: {
  "letter-bounce": {
    "0%, 20%, 100%": { transform: "translateY(0)" },
    "10%": { transform: "translateY(-0.35em)" },
  },
},
animation: {
  "letter-bounce": "letter-bounce 2s ease-in-out infinite",
},
```

Timing budget: a 2s cycle, with each letter bouncing during the first 20% (400ms). Use `STEP = 60ms`. **Keep every word, including `...`, to 16 characters or fewer.** At that length the last letter starts at 900ms and lands at 1300ms, which leaves about a 700ms pause before the next wave begins. If you change the numbers, recheck this budget.

### 3.2 Word list ([src/lib/chatConfig.ts](src/lib/chatConfig.ts) or a new `src/lib/loaderWords.ts`)

Prefer a new file: `chatConfig.ts` is imported by the server route, and this list is client-only.

```ts
export const LOADER_WORDS = [
  "Thinking...",
  "Pondering...",
  "Curating...",
  "Screening...",
  "Rewinding...",
  "Casting...",
  "Popcorning...",
  "Brainstorming...",
  "Directing...",
  "Scouting...",
  "Projecting...",
];
```

Every entry must be 16 characters or fewer (see 3.1). Add a small `shuffle<T>(items: T[]): T[]` (Fisher–Yates, returns a copy) either next to the list or in [src/lib/utils.ts](src/lib/utils.ts).

### 3.3 New component `src/Components/ui/ThinkingLoader.tsx`

A client component (`"use client"`).

Props: `{ words: string[]; startIndex: number }`.

- Local state `index`, initialised to `startIndex`. Use `setInterval(() => setIndex(i => i + 1), ROTATE_MS)` with `ROTATE_MS = 4000` (two 2s waves), and clear it on unmount.
- `word = words[index % words.length]`.
- Render roughly:

```tsx
<p role="status" aria-label="Generating response" className="italic">
  <span key={word} aria-hidden>
    {Array.from(word).map((char, i) => (
      <span
        key={i}
        className="inline-block animate-letter-bounce motion-reduce:animate-none"
        style={{ animationDelay: `${i * STEP_MS}ms` }}
      >
        {char === " " ? " " : char}
      </span>
    ))}
  </span>
</p>
```

- `inline-block` is required, because `transform` has no effect on inline elements.
- `key={word}` remounts the letters, which restarts the wave from the first letter whenever the word changes.
- Keep the text colour and italics consistent with the old `_…_` Markdown placeholder. Italic, inheriting the chat text colour, is enough.

### 3.4 [AssistantMessage.tsx](src/Components/ui/AssistantMessage.tsx)

Add an optional `children?: React.ReactNode` prop and make `message.content` optional.

In the content `<div>`, render `children ?? <Markdown>{message.content}</Markdown>`. Leave the role header and avatar unchanged, so the loader sits inside the normal "CineRadar AI:" message.

### 3.5 [ChatAssistant.tsx](src/Components/ChatAssistant.tsx)

- Replace the `streamingMessage` object state with `const [streamingContent, setStreamingContent] = useState("")`.
- On submit, where `_Generating list..._` is set today, call `setStreamingContent("")`.
- In the `delta` handler, call `setStreamingContent(contentSnapshot)`.
- Loader words and start position:
  - `const [loaderWords, setLoaderWords] = useState(LOADER_WORDS)`, plus `useEffect(() => setLoaderWords(shuffle(LOADER_WORDS)), [])`. Shuffling in an effect keeps the server and client renders identical, so there's no hydration risk.
  - `const loaderTurn = useRef(0)`. Increment it once per submit, at the same point `setStreamingContent("")` is called, and pass `startIndex={loaderTurn.current}`.
- Render in place of the current line 219:

```tsx
{isLoading &&
  (streamingContent ? (
    <AssistantMessage message={{ role: "assistant", content: streamingContent }} />
  ) : (
    <AssistantMessage message={{ role: "assistant" }}>
      <ThinkingLoader words={loaderWords} startIndex={loaderTurn.current} />
    </AssistantMessage>
  ))}
```

- Leave the rest of the flow unchanged: reCAPTCHA, error handling, the last-10 trimming, and the "Generating..." submit button.

---

## 4. Constraints

- Match the existing code style. Only add comments that give context the code can't. Run Prettier (`prettier-plugin-tailwindcss` sorts the classes).
- Don't add dependencies.
- Don't change `/api/assistant` or the stream protocol.

---

## 5. Verification

1. Run `npm run lint` and `npx tsc --noEmit`. Both must pass.
2. Run `npm run dev` with `AI_CHAT_ENABLED=true` and a valid `GEMINI_API_KEY` in `.env`. Leave the reCAPTCHA keys empty to disable reCAPTCHA locally.
3. Use `playwright-cli`, which is installed globally, to open `/`, submit a prompt, and check the following:
   - The loader appears under the user's message, with letters bouncing left to right and then pausing.
   - The word changes about every 4s, and each new word's wave starts from its first letter.
   - The loader is replaced by streamed text as soon as the first chunk arrives.
   - A second prompt in the same session starts on a different word.
   - After a page reload, the order is different most of the time.
   - With reduced motion emulated, letters are static and the words still rotate.
4. If no Gemini key is available, check the loader by temporarily delaying the `fetch` in `handleSubmit`, or by throttling the network in playwright. **Don't commit that change.**
5. With `AI_CHAT_ENABLED=false`, the inert "out of order" preview must still render exactly as before.
