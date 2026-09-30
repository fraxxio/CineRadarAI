// shared by the chat route and client, keep free of server-only code
export const MAX_PROMPT_LENGTH = 1000;
// cap on the partial answer of a stopped turn sent back to the model
export const MAX_STOPPED_TEXT_LENGTH = 10000;
