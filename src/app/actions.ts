"use server";

import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { lists } from "@/db/schema/lists";
import { accounts, sessions, users } from "@/db/schema/users";
import { eq } from "drizzle-orm/sqlite-core/expressions";
import { redirect } from "next/navigation";

export async function SignOut() {
  await signOut({ redirectTo: "/" });
}

export async function DeleteUser(formData: FormData) {
  const session = await auth();

  if (session?.user === undefined) {
    return null;
  }

  if (formData.get("verifyInput") === "Delete account") {
    const userId = formData.get("id") as string;
    try {
      await db.transaction(async (tx) => {
        // Delete related rows in accounts and lists tables first
        await tx.delete(accounts).where(eq(accounts.userId, userId));
        await tx.delete(sessions).where(eq(sessions.userId, userId));
        await tx.delete(lists).where(eq(lists.userId, userId));

        // Delete the user
        await tx.delete(users).where(eq(users.id, userId));
      });
    } catch (error) {
      console.error("Failed to delete account: ", error);
      redirect(`/?deleteAcc=fail`);
    }
    redirect(`/?deleteAcc=success`);
  } else {
    redirect(`/?deleteAcc=fail`);
  }
}
