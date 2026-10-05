"use server";

import { auth, signOut } from "@/infra/auth/auth";
import { db } from "@/infra/db";
import { users } from "@/infra/db/schema/users";
import { eq } from "drizzle-orm/sqlite-core/expressions";
import { redirect } from "next/navigation";

export async function SignOut() {
  await signOut({ redirectTo: "/" });
}

export async function DeleteUser(formData: FormData) {
  const session = await auth();

  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }

  if (formData.get("verifyInput") === "Delete account") {
    try {
      // one statement, so it's atomic: their accounts, sessions and list
      // entries go with the user row (on delete cascade)
      await db.delete(users).where(eq(users.id, userId));
    } catch (error) {
      console.error("Failed to delete account: ", error);
      redirect(`/?deleteAcc=fail`);
    }
    redirect(`/?deleteAcc=success`);
  } else {
    redirect(`/?deleteAcc=fail`);
  }
}
