// shared by the chat route and client, keep free of server-only code
export const MAX_PROMPT_LENGTH = 1000;
// cap on the partial answer of a stopped turn sent back to the model
export const MAX_STOPPED_TEXT_LENGTH = 10000;
// stopped turns sent with one request: 5 prompt/answer pairs fill the 10 messages the chat keeps
export const MAX_STOPPED_TURNS = 5;
// list entries changed outside the model (Undo, saves after sign-in) sent
// with one request; the turn's saves fit, the chat keeps 10 messages
export const MAX_LIST_CHANGES = 10;
