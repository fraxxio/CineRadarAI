import { vi } from "vitest";

// the my-list barrel reaches the list row's server actions, which pull in
// next-auth and the DB
vi.mock("@/modules/my-list/actions", () => ({
  updateEntryStatus: vi.fn(),
  updateEntryRating: vi.fn(),
  removeListEntry: vi.fn(),
}));
