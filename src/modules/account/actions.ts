"use server";

import { auth, signIn, signOut } from "@/infra/auth/auth";
import { db } from "@/infra/db";
import { users } from "@/infra/db/schema/users";
import { safeRedirect } from "@/shared/lib/safeRedirect";
import { eq } from "drizzle-orm/sqlite-core/expressions";
import { redirect } from "next/navigation";
import { DELETE_CONFIRMATION } from "./deleteConfirmation";

const PROVIDERS = ["google", "github"];

// the sign-in page's and the chat's sign-in card's provider buttons; signIn
// redirects by throwing NEXT_REDIRECT, so it isn't caught
export async function signInWithProvider(formData: FormData) {
  const provider = formData.get("provider");
  if (typeof provider !== "string" || !PROVIDERS.includes(provider)) {
    throw new Error("Unknown sign-in provider");
  }
  await signIn(provider, {
    redirectTo: safeRedirect(formData.get("callbackUrl")),
  });
}

export async function SignOut() {
  await signOut({ redirectTo: "/" });
}

export async function DeleteUser(formData: FormData) {
  const session = await auth();

  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }

  if (formData.get("verifyInput") === DELETE_CONFIRMATION) {
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
