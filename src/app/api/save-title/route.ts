import { auth } from "@/infra/auth/auth";
import { revalidatePath } from "next/cache";
import { TmdbError } from "@/infra/tmdb/server";
import { titleToSaveInput } from "@/modules/my-list";
import { SaveTitleError, saveTitle } from "@/modules/my-list/server";

// the chat's saves that waited for the user to sign in; answers with the
// same payload as the chat's list_saved event
export async function PUT(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "signed_out" }, { status: 401 });
  }

  const parsed = titleToSaveInput.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const { entry, previous } = await saveTitle(userId, parsed.data);
    revalidatePath("/my-list", "page");
    return Response.json({ entry, previous });
  } catch (error) {
    if (error instanceof SaveTitleError) {
      return Response.json(
        { error: error.rejection.reason },
        { status: 422 },
      );
    }
    console.error("Failed to save the title after sign-in:", error);
    return Response.json(
      { error: "save_failed" },
      { status: error instanceof TmdbError ? 502 : 500 },
    );
  }
}
