import { beforeEach, describe, expect, it, test, vi } from "vitest";
import { revalidatePath } from "next/cache";
import {
  removeListEntry,
  updateEntryRating,
  updateEntryStatus,
} from "./actions";
import { asUser } from "@test/helpers/auth";
import { forceFailure, getMovies, seedList, seedUser } from "@test/helpers/db";
import { makeMovie } from "@test/helpers/factories";

vi.mock("@/infra/auth/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

const key = { movieId: 550, type: "movie" as const };
const stored = makeMovie({ movieId: 550, status: "Completed", rating: 8 });

let user: Awaited<ReturnType<typeof seedUser>>;

beforeEach(async () => {
  user = await seedUser();
  asUser(user);
  await seedList(user.id, [stored]);
});

// data behaviour (matching, other users) is covered by store.int.test.ts
describe("updateEntryStatus", () => {
  test("changes the status, keeps the rating and revalidates", async () => {
    await expect(updateEntryStatus(key, "Watching")).resolves.toEqual({
      ok: true,
    });

    expect(await getMovies(user.id)).toEqual([
      { ...stored, status: "Watching" },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/my-list");
  });

  it.each(["Dropped", "", "watching"])(
    "rejects the status %j and writes nothing",
    async (status) => {
      await expect(updateEntryStatus(key, status)).resolves.toEqual({
        ok: false,
      });

      expect(await getMovies(user.id)).toEqual([stored]);
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );
});

describe("updateEntryRating", () => {
  test("changes the rating, keeps the status and revalidates", async () => {
    await expect(updateEntryRating(key, 3)).resolves.toEqual({ ok: true });

    expect(await getMovies(user.id)).toEqual([{ ...stored, rating: 3 }]);
    expect(revalidatePath).toHaveBeenCalledWith("/my-list");
  });

  test("0 clears the rating", async () => {
    await expect(updateEntryRating(key, 0)).resolves.toEqual({ ok: true });

    expect(await getMovies(user.id)).toEqual([{ ...stored, rating: 0 }]);
  });

  it.each([-1, 11, 2.5, NaN, "8"])(
    "rejects the rating %j and writes nothing",
    async (rating) => {
      await expect(updateEntryRating(key, rating as number)).resolves.toEqual({
        ok: false,
      });

      expect(await getMovies(user.id)).toEqual([stored]);
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );
});

describe("removeListEntry", () => {
  test("removes the entry and revalidates", async () => {
    await expect(removeListEntry(key)).resolves.toEqual({ ok: true });

    expect(await getMovies(user.id)).toEqual([]);
    expect(revalidatePath).toHaveBeenCalledWith("/my-list");
  });

  test("succeeds when the entry is already gone", async () => {
    await expect(
      removeListEntry({ movieId: 1, type: "movie" }),
    ).resolves.toEqual({ ok: true });

    expect(await getMovies(user.id)).toEqual([stored]);
  });
});

const calls = [
  ["updateEntryStatus", (k: typeof key) => updateEntryStatus(k, "Watching")],
  ["updateEntryRating", (k: typeof key) => updateEntryRating(k, 3)],
  ["removeListEntry", (k: typeof key) => removeListEntry(k)],
] as const;

describe.each(calls)("%s", (_, call) => {
  test("does nothing for a signed-out user", async () => {
    asUser(null);

    await expect(call(key)).resolves.toEqual({ ok: false });

    expect(await getMovies(user.id)).toEqual([stored]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    { movieId: 0, type: "movie" },
    { movieId: 550, type: "person" },
    { movieId: "abc", type: "movie" },
  ])("rejects the key %j", async (bad) => {
    await expect(call(bad as unknown as typeof key)).resolves.toEqual({
      ok: false,
    });

    expect(await getMovies(user.id)).toEqual([stored]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test("returns a failure instead of throwing when the write fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await forceFailure("UPDATE", "list_entries");
    await forceFailure("DELETE", "list_entries");

    await expect(call(key)).resolves.toEqual({ ok: false });

    expect(await getMovies(user.id)).toEqual([stored]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updating a title that isn't in the list", () => {
  it.each(calls.slice(0, 2))(
    "%s fails, inserts nothing and revalidates",
    async (_, call) => {
      const missing = { movieId: 1, type: "movie" as const };

      await expect(call(missing)).resolves.toEqual({ ok: false });

      expect(await getMovies(user.id)).toEqual([stored]);
      // the page drops the stale row
      expect(revalidatePath).toHaveBeenCalledWith("/my-list");
    },
  );
});
