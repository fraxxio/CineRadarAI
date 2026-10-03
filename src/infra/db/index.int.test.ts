import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { db, writeTransaction } from "./index";
import { users } from "./schema/users";
import { seedUser } from "@test/helpers/db";

const nameOf = async (id: string) =>
  (await db.select().from(users).where(eq(users.id, id)))[0]?.name;

const rename = (id: string, name: string) =>
  writeTransaction((tx) =>
    tx.update(users).set({ name }).where(eq(users.id, id)),
  );

// the integration DB is a file: URL, so these run with the in-process queue
describe("writeTransaction", () => {
  test("commits what fn writes and resolves to its result", async () => {
    const user = await seedUser();

    await expect(
      writeTransaction(async (tx) => {
        await tx.update(users).set({ name: "A" }).where(eq(users.id, user.id));
        return "done";
      }),
    ).resolves.toBe("done");

    expect(await nameOf(user.id)).toBe("A");
  });

  test("rolls back when fn throws", async () => {
    const user = await seedUser({ name: "before" });

    await expect(
      writeTransaction(async (tx) => {
        await tx.update(users).set({ name: "A" }).where(eq(users.id, user.id));
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");

    expect(await nameOf(user.id)).toBe("before");
  });

  test("a write transaction waits for the one in progress (file: client)", async () => {
    const user = await seedUser();
    const order: string[] = [];

    await Promise.all([
      writeTransaction(async (tx) => {
        order.push("first start");
        // yield to I/O while holding the lock; without the queue the second
        // BEGIN IMMEDIATE would fail with SQLITE_BUSY here
        await new Promise((resolve) => setTimeout(resolve, 20));
        await tx.update(users).set({ name: "A" }).where(eq(users.id, user.id));
        order.push("first end");
      }),
      writeTransaction(async (tx) => {
        order.push("second start");
        await tx.update(users).set({ name: "B" }).where(eq(users.id, user.id));
      }),
    ]);

    expect(order).toEqual(["first start", "first end", "second start"]);
    expect(await nameOf(user.id)).toBe("B");
  });

  test("a failed transaction doesn't block the next one", async () => {
    const user = await seedUser();

    const failed = writeTransaction(async () => {
      throw new Error("abort");
    });
    const next = rename(user.id, "A");

    await expect(failed).rejects.toThrow("abort");
    await next;
    expect(await nameOf(user.id)).toBe("A");
  });

  test("a nested call rejects instead of waiting for itself", async () => {
    const user = await seedUser({ name: "before" });

    await expect(
      writeTransaction(async (tx) => {
        await tx.update(users).set({ name: "A" }).where(eq(users.id, user.id));
        await rename(user.id, "B");
      }),
    ).rejects.toThrow("writeTransaction can't be nested");

    expect(await nameOf(user.id)).toBe("before");
    // and the queue still works afterwards
    await rename(user.id, "C");
    expect(await nameOf(user.id)).toBe("C");
  });
});
