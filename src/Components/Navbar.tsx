"use client";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { useState } from "react";
import AuthBtn from "./AuthBtn";

type NavbarProps = {
  user:
    | {
        id: string;
        name: string;
        email: string;
        image: string;
      }
    | undefined;
};

const Navbar = ({ user }: NavbarProps) => {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const { id } = user || {};

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
      <nav
        id="top"
        className="sticky top-0 z-10 border-b border-border-clr bg-primary-bg"
      >
        <div className="container flex items-center justify-between py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-2xl font-bold no-underline"
          >
            <Image src="/CineRadarLogo.png" width={35} height={35} alt="Logo" />
            CineRadar
          </Link>
          <ul className="flex items-center gap-4 font-medium max-[640px]:hidden">
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
              {id ? (
                <AuthBtn user={user} />
              ) : (
                <Link href="/signin">Sign In</Link>
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
            <Link href="/search">Manual Search</Link>
          </li>
          <li>
            <Link href="/mylist">My list</Link>
          </li>
          <li>
            <Link href="#">About</Link>
          </li>
          <li>
            {id ? <AuthBtn user={user} /> : <Link href="/signin">Sign In</Link>}
          </li>
        </ul>
      </div>
    </>
  );
};

export default Navbar;
