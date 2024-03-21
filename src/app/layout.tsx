import type { Metadata } from "next";
import { Sora } from "next/font/google";
import Navbar from "@/Components/Navbar";
import { ClerkProvider, auth } from "@clerk/nextjs";
import "./globals.css";
import Footer from "@/Components/Footer";

const sora = Sora({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CineRadar AI",
  description: "Movie recommendations generator AI",
};

const { userId } = auth();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignInUrl='/' afterSignUpUrl='/'>
      <html lang='en'>
        <body className={sora.className}>
          <Navbar userId={userId} />
          {children}
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  );
}
