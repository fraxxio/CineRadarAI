import { auth } from "@/auth";
import { AlertTriangleIcon } from "lucide-react";
import Image from "next/image";

export default async function page() {
  const session = await auth();
  if (session?.user === undefined) {
    return (
      <main className="container flex items-center justify-center gap-4 pt-40">
        <AlertTriangleIcon size={50} color="red" />
        <p className="text-3xl">You need to be logged in to acces this page.</p>
      </main>
    );
  }

  const safeSession = session!;
  return (
    <div>
      <Image
        alt="profile"
        width={100}
        height={100}
        src={safeSession.user.image}
      />
      <p>{safeSession.user.name}</p>
    </div>
  );
}
