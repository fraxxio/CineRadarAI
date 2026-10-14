import { signInWithProvider } from "@/modules/account/actions";
import { safeRedirect } from "@/shared/lib/safeRedirect";
import { SignInButtons } from "@/shared/ui/SignInButtons";
import React from "react";

export default function page({
  searchParams,
}: {
  searchParams: { callbackUrl?: string | string[] };
}) {
  return (
    <main className="container my-auto">
      <section className="border border-border-clr bg-primary-bg pb-8 pt-4">
        <h1 className="text-center text-3xl font-medium">Sign In</h1>
        <SignInButtons
          action={signInWithProvider}
          callbackUrl={safeRedirect(searchParams.callbackUrl)}
        />
      </section>
    </main>
  );
}
