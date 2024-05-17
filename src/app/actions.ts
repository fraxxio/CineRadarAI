"use server";

import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema/users";
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
      console.error("Failed to delete account: ", error);
      redirect(`/?deleteAcc=fail`);
    }
    redirect(`/?deleteAcc=success`);
  } else {
    redirect(`/?deleteAcc=fail`);
  }
}

export async function SortList(formData: FormData) {
  const formRating = formData.get("rating") as string;
  const formStatus = formData.get("status") as string;
  const formType = formData.get("type") as string;

  const rating =
    formRating === "asc"
      ? "?rating=asc"
      : formRating === "desc"
        ? "?rating=desc"
        : `?rating=${formData.get("currRating") as string}`;

  const status =
    formStatus === "planning"
      ? "&status=planning"
      : formStatus === "completed"
        ? "&status=completed"
        : formStatus === "watching"
          ? "&status=watching"
          : formStatus === "all"
            ? "&status=all"
            : `&status=${formData.get("currStatus") as string}`;

  const type =
    formType === "movie"
      ? "&type=movie"
      : formType === "tv"
        ? "&type=tv"
        : formType === "both"
          ? "&type=both"
          : `&type=${formData.get("currType") as string}`;

  redirect(`/my-list${rating}${status}${type}`);
}
