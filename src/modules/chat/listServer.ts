// the list's server code, loaded only when a save or a list-change note runs:
// it needs the DB client and React's cache, which scripts/check-chat-tools.ts
// can't load (it loads the tools and the system prompt, not their handlers)
export const listServer = () => import("@/modules/my-list/server");

export type ListServer = Awaited<ReturnType<typeof listServer>>;
