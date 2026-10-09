// newline-delimited JSON events streamed by POST /api/assistant
export type ChatStreamEvent =
  | { type: "start"; interactionId: string }
  | { type: "delta"; text: string }
  // tools are running, e.g. "Searching TMDB database..."; the next delta ends it
  | { type: "status"; text: string }
  // a tool call started; `id` is the Gemini call id, `name` the tool name,
  // `text` its progress label, e.g. "Searching TMDB database..."
  | { type: "tool_start"; id: string; name: string; text: string }
  // the call with this id finished (not sent when the turn is stopped or fails)
  | { type: "tool_end"; id: string }
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

export type TextPart = { type: "text"; text: string };

// one line per tool; calls of the same tool in one tool block share it
export type ToolPart = {
  type: "tool";
  name: string;
  label: string;
  // every call merged into this line; the counter is its length
  callIds: string[];
  // calls that haven't ended yet; the line is running while non-empty
  runningIds: string[];
  // active time of the finished stretches
  elapsedMs: number;
  // client time the current running stretch began; undefined when not running
  runningSince?: number;
};

// future: | { type: "titles"; items: ... } for movie cards
export type MessagePart = TextPart | ToolPart;

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
  // the user stopped this answer before it finished
  stopped?: boolean;
};

export type Tmessage = {
  id: string;
  role: string;
  content: string;
  // the user stopped this answer before it finished
  stopped?: boolean;
}[];
