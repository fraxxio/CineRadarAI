import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { Footer, Navbar } from "@/modules/layout";
import { Toaster } from "@/shared/ui/Toaster";
import "./globals.css";
import { getSession } from "@/infra/auth/session";

const sora = Sora({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CineRadar AI",
  description: "Movie recommendations generator AI",
  icons: "/CineRadarLogo.png",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html lang="en">
      <body className={sora.className}>
        <Navbar user={session?.user} />
        {children}
        <Toaster
          toastOptions={{
            classNames: {
              toast: "bg-primary-bg text-primary-text border border-border-clr",
              title: "font-semibold text-base",
              description: "text-base",
            },
          }}
        />
        <Footer />
      </body>
    </html>
  );
}
