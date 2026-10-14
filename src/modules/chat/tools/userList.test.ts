import { beforeEach, describe, expect, test, vi } from "vitest";
import { deferred } from "@test/helpers/deferred";
import { makeMovie } from "@test/helpers/factories";
import { userList } from "./userList";

const { getEntries } = vi.hoisted(() => ({ getEntries: vi.fn() }));
vi.mock("@/modules/my-list/server", () => ({ getEntries }));

beforeEach(() => {
  getEntries.mockReset();
});

const signedIn = { status: "signed_in", id: "u1" } as const;
const fury = makeMovie({ movieId: 228150, name: "Fury" });

describe("userList", () => {
  test.each([
    { status: "signed_out" } as const,
    { status: "unavailable" } as const,
  ])("$status: null, no DB read", async (user) => {
    const { list } = userList(user);
    expect(await list()).toBeNull();
    expect(getEntries).not.toHaveBeenCalled();
  });

  test("signed in: the session user's entries", async () => {
    getEntries.mockResolvedValue([fury]);
    expect(await userList(signedIn).list()).toEqual([fury]);
    expect(getEntries).toHaveBeenCalledWith("u1");
  });

  test("calls in parallel and after the read share one DB read", async () => {
    getEntries.mockResolvedValue([fury]);
    const { list } = userList(signedIn);
    const [a, b] = await Promise.all([list(), list()]);
    const c = await list();
    expect([a, b, c]).toEqual([[fury], [fury], [fury]]);
    expect(getEntries).toHaveBeenCalledTimes(1);
  });

  test("a failed read rejects, the next call reads again", async () => {
    getEntries
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce([fury]);
    const { list } = userList(signedIn);
    await expect(list()).rejects.toThrow("db down");
    expect(await list()).toEqual([fury]);
    expect(getEntries).toHaveBeenCalledTimes(2);
  });

  test("after invalidate the next call reads again", async () => {
    const saved = makeMovie({ movieId: 1, name: "Saved" });
    getEntries.mockResolvedValueOnce([fury]).mockResolvedValueOnce([saved]);
    const { list, invalidate } = userList(signedIn);
    expect(await list()).toEqual([fury]);
    invalidate();
    expect(await list()).toEqual([saved]);
    expect(getEntries).toHaveBeenCalledTimes(2);
  });

  test("an invalidated read failing late doesn't drop the newer read", async () => {
    const stale = deferred<never>();
    getEntries.mockReturnValueOnce(stale.promise).mockResolvedValueOnce([fury]);
    const { list, invalidate } = userList(signedIn);
    const first = list();
    // pending in the DB; Vitest fails two concurrent imports of a mocked
    // module, so the second read mustn't start while the first imports
    await vi.waitFor(() => expect(getEntries).toHaveBeenCalledTimes(1));
    invalidate();
    expect(await list()).toEqual([fury]);
    stale.reject(new Error("db down"));
    await expect(first).rejects.toThrow("db down");
    expect(await list()).toEqual([fury]);
    expect(getEntries).toHaveBeenCalledTimes(2);
  });
});
