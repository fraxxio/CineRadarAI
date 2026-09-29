import { vi } from "vitest";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { makeSession } from "./factories";

// Only for files that call vi.mock("@/auth", () => ({ auth: vi.fn(), ... })).
// `auth` is overloaded (it's also a middleware wrapper), so narrow it to the session getter.
export const asUser = (u: { id: string } | null) =>
  vi
    .mocked(auth as unknown as () => Promise<Session | null>)
    .mockResolvedValue(u && makeSession(u as Session["user"]));
