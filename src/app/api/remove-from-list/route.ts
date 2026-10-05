import { auth } from "@/infra/auth/auth";
import { revalidatePath } from "next/cache";
import { entryKeyInput } from "@/modules/my-list";
import { removeEntry } from "@/modules/my-list/server";

export async function DELETE(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ addToListResult: "fail" }, { status: 401 });
  }

  const parsed = entryKeyInput.safeParse({
    movieId: request.headers.get("movieId"),
    type: request.headers.get("type"),
  });
  if (!parsed.success) {
    return Response.json({ addToListResult: "fail" }, { status: 400 });
  }

  try {
    await removeEntry(userId, parsed.data);
    revalidatePath("/my-list", "page");
    return Response.json({ addToListResult: "success" });
  } catch (error) {
    console.error(error);
    return Response.json({ addToListResult: "fail" });
  }
}
