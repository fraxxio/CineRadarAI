// newline-delimited JSON events streamed by POST /api/assistant
type ChatStreamEvent =
  | { type: "start"; interactionId: string }
  | { type: "delta"; text: string }
  | { type: "done"; interactionId: string }
  | { type: "error" };

// a turn the user stopped mid-answer; the model hasn't seen it yet
type StoppedTurn = { prompt: string; partialText: string };

// JSON body of POST /api/assistant
type ChatRequest = {
  content: string;
  previousInteractionId?: string;
  stoppedTurn?: StoppedTurn;
};
