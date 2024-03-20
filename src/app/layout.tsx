import type { Metadata } from "next";
import { Sora } from "next/font/google";
import Navbar from "@/Components/Navbar";
import "./globals.css";

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
    <html lang='en'>
      <body className={sora.className}>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
