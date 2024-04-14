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
    <main className="container">
      <section className="mt-20 border border-border-clr bg-primary-bg p-4">
        <h1 className="text-center text-3xl">
          <b>{safeSession.user.name}</b> movie and TV show list.
        </h1>
      </section>
    </main>
  );
}
