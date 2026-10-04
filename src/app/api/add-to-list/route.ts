import { auth } from "@/infra/auth/auth";
import { revalidatePath } from "next/cache";
import { entryInput } from "@/modules/my-list";
import { saveEntry } from "@/modules/my-list/server";

export async function PUT(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ addToListResult: "fail" }, { status: 401 });
  }

  const parsed = entryInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ addToListResult: "fail" }, { status: 400 });
  }

  try {
    await saveEntry(userId, parsed.data);
    revalidatePath("/my-list", "page");
    return Response.json({ addToListResult: "success" });
  } catch (error) {
    console.error(error);
    return Response.json({ addToListResult: "fail" });
  }
}
