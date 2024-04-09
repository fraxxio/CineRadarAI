export async function PUT(request: Request) {
  const id = request.headers.get("id");

  console.log("ID from header:", id);
  //   const res = await fetch("someapi");
  //   const data = await res.json();

  return Response.json({ data: "gelooo" });
}
