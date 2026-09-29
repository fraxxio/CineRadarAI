import { beforeEach, describe, expect, test, vi } from "vitest";
import { redirect } from "next/navigation";
import { DeleteUser } from "@/app/actions";
import { asUser } from "../helpers/auth";
import { forceFailure, seedFullUser, userRows } from "../helpers/db";

vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", async () => {
  const { RedirectError } = await import("../helpers/next");
  return {
    redirect: vi.fn((url: string) => {
      throw new RedirectError(url);
    }),
  };
});

const form = (verify: string, id: string) => {
  const f = new FormData();
  f.set("verifyInput", verify);
  f.set("id", id);
  return f;
};

const all = { users: 1, accounts: 1, sessions: 1, lists: 1 };
const none = { users: 0, accounts: 0, sessions: 0, lists: 0 };

let a: Awaited<ReturnType<typeof seedFullUser>>;
let b: Awaited<ReturnType<typeof seedFullUser>>;

beforeEach(async () => {
  a = await seedFullUser();
  b = await seedFullUser();
});

describe("DeleteUser", () => {
  test("returns null and touches nothing without a session", async () => {
    asUser(null);

    await expect(DeleteUser(form("Delete account", a.id))).resolves.toBeNull();

    expect(await userRows(a.id)).toEqual(all);
    expect(vi.mocked(redirect)).not.toHaveBeenCalled();
  });

  test("redirects to fail and deletes nothing on wrong confirmation text", async () => {
    asUser(a);

    await expect(
      DeleteUser(form("delete account", a.id)),
    ).rejects.toMatchObject({ url: "/?deleteAcc=fail" });

    expect(await userRows(a.id)).toEqual(all);
  });

  test("deletes all of the user's rows and redirects to success", async () => {
    asUser(a);

    await expect(
      DeleteUser(form("Delete account", a.id)),
    ).rejects.toMatchObject({ url: "/?deleteAcc=success" });

    expect(await userRows(a.id)).toEqual(none);
    expect(await userRows(b.id)).toEqual(all);
  });

  test("rolls back every delete when the transaction fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    asUser(a);
    // the user row is deleted last, so the earlier deletes must be rolled back
    await forceFailure("DELETE", "user");

    await expect(
      DeleteUser(form("Delete account", a.id)),
    ).rejects.toMatchObject({ url: "/?deleteAcc=fail" });

    expect(await userRows(a.id)).toEqual(all);
  });

  test("[B3] only deletes the session user, ignoring the form id", async () => {
    asUser(a);

    await DeleteUser(form("Delete account", b.id)).catch(() => {});

    expect(await userRows(b.id)).toEqual(all);
    expect(await userRows(a.id)).toEqual(none);
  });
});
