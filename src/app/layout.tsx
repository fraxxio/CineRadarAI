import type { Metadata } from "next";
import { Sora } from "next/font/google";
import Navbar from "@/Components/Navbar";
import { Toaster } from "@/Components/ui/sonner";
import "./globals.css";
import Footer from "@/Components/Footer";

const sora = Sora({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CineRadar AI",
  description: "Movie recommendations generator AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={sora.className}>
        <Navbar userId={"1"} />
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
