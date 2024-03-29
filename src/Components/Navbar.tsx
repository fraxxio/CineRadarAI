"use client";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import React, { useState } from "react";

type NavbarProps = {
  userId: string | null;
};

const Navbar = ({ userId }: NavbarProps) => {
  const [isNavOpen, setIsNavOpen] = useState(false);

  function hMovibileNavbar() {
    const menu = document.getElementById("menu") as HTMLElement;
    const x = document.getElementById("x") as HTMLElement;
    const MobileNav = document.getElementById("MobileNav") as HTMLElement;

    if (isNavOpen) {
      setIsNavOpen(false);
      menu.classList.remove("hidden");
      x.classList.add("hidden");
      MobileNav.classList.replace("translate-y-[4rem]", "-translate-y-[10rem]");
    } else {
      setIsNavOpen(true);
      menu.classList.add("hidden");
      x.classList.remove("hidden");
      MobileNav.classList.replace("-translate-y-[10rem]", "translate-y-[4rem]");
    }
  }

  return (
    <>
      <nav className="sticky z-10 border-b border-border-clr bg-primary-bg">
        <div className="container flex items-center justify-between py-4">
          <a href="/" className="text-2xl font-bold">
            CineRadar
          </a>
          <ul className="flex items-center gap-4 font-medium max-[640px]:hidden">
            <li>
              <Link href="#">Trending</Link>
            </li>
            <li>
              <Link href="/search">Manual Search</Link>
            </li>
            <li>
              <Link href="/my-list">My list</Link>
            </li>
            <li>
              <Link href="#">About</Link>
            </li>
            <li>
              {userId ? (
                <UserButton afterSignOutUrl="/" />
              ) : (
                <Link href="/sign-in">Sign In</Link>
              )}
            </li>
          </ul>
          <button className="min-[640px]:hidden" onClick={hMovibileNavbar}>
            <Menu id="menu" />
            <X id="x" className="hidden" />
          </button>
        </div>
      </nav>
      <div
        id="MobileNav"
        className="fixed z-0 w-full -translate-y-[10rem] border-b border-border-clr bg-primary-bg duration-[400ms] ease-in"
      >
        <ul className="flex flex-col items-center gap-4 py-4 font-medium min-[510px]:hidden">
          <li>
            <Link href="#">Trending</Link>
          </li>
          <li>
            <Link href="/search">Manual Search</Link>
          </li>
          <li>
            <Link href="/mylist">My list</Link>
          </li>
          <li>
            <Link href="#">About</Link>
          </li>
          <li>
            {userId ? (
              <UserButton afterSignOutUrl="/" />
            ) : (
              <Link href="/sign-in">Sign In</Link>
            )}
          </li>
        </ul>
      </div>
    </>
  );
};

export default Navbar;
