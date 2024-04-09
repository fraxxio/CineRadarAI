import { clerkClient } from "@clerk/nextjs";

export async function PUT(request: Request) {
  const { isSignedIn } = await clerkClient.authenticateRequest({
    request: request,
  });

  if (!isSignedIn) {
    return Response.json(
      { message: "You need to be logged in!" },
      { status: 401 },
    );
  }

  const id = request.headers.get("id");

  console.log("ID from header:", id);
  //   const res = await fetch("someapi");
  //   const data = await res.json();

  return Response.json({ data: "gelooo" });
}
