// newline-delimited JSON events streamed by POST /api/assistant
type ChatStreamEvent =
  | { type: "start"; interactionId: string }
  | { type: "delta"; text: string }
  | { type: "done"; interactionId: string }
  | { type: "error" };
