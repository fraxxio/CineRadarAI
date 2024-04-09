import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { db } from "./db";

export const { handlers, auth } = NextAuth({
  providers: [GitHub, Google],
  adapter: DrizzleAdapter(db),
});
