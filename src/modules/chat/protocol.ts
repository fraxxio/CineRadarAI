import type { MediaType } from "@/infra/tmdb";
import type {
  EntryKey,
  ListStatus,
  PreviousEntry,
  SavedEntry,
} from "@/modules/my-list";

export type { PreviousEntry, SavedEntry };

// newline-delimited JSON events streamed by POST /api/assistant
export type ChatStreamEvent =
  | { type: "start"; interactionId: string }
  | { type: "delta"; text: string }
  // a tool call started; `id` is the Gemini call id, `name` the tool name,
  // `text` its progress label, e.g. "Searching TMDB database..."
  | { type: "tool_start"; id: string; name: string; text: string }
  // the call with this id finished (not sent when the turn is stopped or fails)
  | { type: "tool_end"; id: string }
  // a show_recommendations call finished; only the titles TMDB confirmed, in
  // the model's order
  | { type: "cards"; items: RecommendedTitle[] }
  // a save_to_list call saved a title (or found it unchanged); `previous` is
  // the row before, for Undo, null when the title was new
  | { type: "list_saved"; entry: SavedEntry; previous: PreviousEntry | null }
  // a save_to_list call of a signed-out user
  | { type: "sign_in_required"; save: PendingSave }
  | { type: "done"; interactionId: string }
  | { type: "error" };

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

// a save that needs the user to sign in first
export type PendingSave = {
  type: MediaType;
  id: number;
  // TMDB's
  title: string;
  posterPath: string | null;
  // null: "Planning to watch" for a new title, unchanged otherwise
  status: ListStatus | null;
};

// a turn the user stopped mid-answer; the model hasn't seen it yet
export type StoppedTurn = { prompt: string; partialText: string };

// JSON body of POST /api/assistant
export type ChatRequest = {
  content: string;
  previousInteractionId?: string;
  // oldest first
  stoppedTurns?: StoppedTurn[];
  // entries changed outside the model since the last turn; the server tells
  // the model their state from the DB
  listChanges?: EntryKey[];
};

// JSON body of a POST /api/assistant that failed before streaming; 409
// "conversation_expired": Gemini no longer has previousInteractionId
export type ChatErrorResponse = { error: string };

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

export type CardsPart = { type: "cards"; items: RecommendedTitle[] };

export type MessagePart = TextPart | ToolPart | CardsPart;

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
  // the user stopped this answer before it finished
  stopped?: boolean;
};
