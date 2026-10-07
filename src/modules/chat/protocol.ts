// newline-delimited JSON events streamed by POST /api/assistant
export type ChatStreamEvent =
  | { type: "start"; interactionId: string }
  | { type: "delta"; text: string }
  // tools are running, e.g. "Searching TMDB database..."; the next delta ends it
  | { type: "status"; text: string }
  | { type: "done"; interactionId: string }
  | { type: "error" };

// a turn the user stopped mid-answer; the model hasn't seen it yet
export type StoppedTurn = { prompt: string; partialText: string };

// JSON body of POST /api/assistant
export type ChatRequest = {
  content: string;
  previousInteractionId?: string;
  // oldest first
  stoppedTurns?: StoppedTurn[];
};

export type Tmessage = {
  id: string;
  role: string;
  content: string;
  // the user stopped this answer before it finished
  stopped?: boolean;
}[];
