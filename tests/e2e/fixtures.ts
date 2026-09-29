import { test as base, expect } from "@playwright/test";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { randomUUID } from "node:crypto";
import { sessions, users } from "../../src/db/schema/users";
import { BASE_URL, DB_URL } from "./env";

export type TestUser = {
  id: string;
  name: string;
  email: string;
  image: string;
};

type TestFixtures = {
  stubAssets: void;
  seedUser: (o?: Partial<TestUser>) => Promise<TestUser>;
  loginAs: (o?: Partial<TestUser>) => Promise<TestUser>;
};
type WorkerFixtures = { db: LibSQLDatabase };

export const test = base.extend<TestFixtures, WorkerFixtures>({
  db: [
    async ({}, use) => {
      const client = createClient({ url: DB_URL });
      await use(drizzle(client));
      client.close();
    },
    { scope: "worker" },
  ],

  stubAssets: [
    async ({ page }, use) => {
      await page.route("https://image.tmdb.org/**", (r) =>
        r.fulfill({ path: "tests/fixtures/pixel.png" }),
      );
      await page.route("https://www.youtube.com/**", (r) =>
        r.fulfill({ body: "<html></html>", contentType: "text/html" }),
      );
      await use();
    },
    { auto: true },
  ],

  seedUser: async ({ db }, use) => {
    await use(async (o = {}) => {
      const id = o.id ?? randomUUID();
      // local image: avoids stubbing avatar hosts
      const user = {
        id,
        name: `E2E ${id.slice(0, 6)}`,
        email: `${id}@e2e.test`,
        image: "/CineRadarLogo.png",
        ...o,
      };
      await db.insert(users).values(user);
      return user;
    });
  },

  // database sessions: the cookie holds the raw sessionToken (authjs.session-token over http)
  loginAs: async ({ context, db, seedUser }, use) => {
    await use(async (o) => {
      const user = await seedUser(o);
      const token = randomUUID();
      await db.insert(sessions).values({
        sessionToken: token,
        userId: user.id,
        expires: new Date(Date.now() + 86_400_000),
      });
      await context.addCookies([
        {
          name: "authjs.session-token",
          value: token,
          url: BASE_URL,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      return user;
    });
  },
});
export { expect };
