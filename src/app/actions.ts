"use server";

import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { accounts, users } from "@/db/schema/users";
import { movieFilterSchema } from "@/lib/validation";
import { eq } from "drizzle-orm/sqlite-core/expressions";
import { redirect } from "next/navigation";

export async function fetchMovies(formData: FormData) {
  const values = Object.fromEntries(formData.entries());
  const { query, language, year, adult, btn } = movieFilterSchema.parse(values);

  const searchParams = new URLSearchParams({
    ...(query && { query: query?.trim() }),
    ...(language && { language }),
    ...(year && { year }),
    ...(adult && { adult: "true" }),
    ...(btn && { btn }),
  });

  redirect(`/search?${searchParams.toString()}`);
}

export async function SignOut() {
  await signOut({ redirectTo: "/" });
}

export async function DeleteUser(formData: FormData) {
  const session = await auth();

  if (session?.user === undefined) {
    return null;
  }

  if (formData.get("verifyInput") === "Delete account") {
    try {
      await db.delete(users).where(eq(users.id, formData.get("id") as string));
    } catch (error) {
      redirect(`/?deleteAcc=fail`);
    }
    redirect(`/?deleteAcc=success`);
  } else {
    redirect(`/?deleteAcc=fail`);
  }
}
