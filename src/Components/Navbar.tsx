"use client";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

const Navbar = () => {
  const [isNavOpen, setIsNavOpen] = useState(false);
  function hMovibileNavbar() {
    const menu = document.getElementById("menu") as HTMLElement;
    const x = document.getElementById("x") as HTMLElement;
    const MobileNav = document.getElementById("MobileNav") as HTMLElement;

    if (isNavOpen) {
      setIsNavOpen(false);
      menu.classList.remove("hidden");
      x.classList.add("hidden");
      MobileNav.classList.replace("-translate-y-[0rem]", "-translate-y-[9rem]");
    } else {
      setIsNavOpen(true);
      menu.classList.add("hidden");
      x.classList.remove("hidden");
      MobileNav.classList.replace("-translate-y-[9rem]", "-translate-y-[0rem]");
    }
  }

  return (
    <>
      <nav className='bg-primary-bg border-b border-border-clr z-10 sticky'>
        <div className='flex items-center justify-between container py-4'>
          <a href='/' className='text-2xl font-bold'>
            CineRadar
          </a>
          <ul className='flex gap-4 font-medium max-[450px]:hidden'>
            <li>
              <Link href='#'>Trending</Link>
            </li>
            <li>
              <Link href='#'>My list</Link>
            </li>
            <li>
              <Link href='#'>Sign In</Link>
            </li>
          </ul>
          <button className='min-[450px]:hidden' onClick={hMovibileNavbar}>
            <Menu id='menu' />
            <X id='x' className='hidden' />
          </button>
        </div>
      </nav>
      <div
        id='MobileNav'
        className='bg-primary-bg border-b border-border-clr z-0 fixed w-full duration-[400ms] ease-in -translate-y-[9rem]'
      >
        <ul className='flex flex-col items-center gap-4 font-medium min-[450px]:hidden py-4'>
          <li>
            <Link href='#'>Trending</Link>
          </li>
          <li>
            <Link href='#'>My list</Link>
          </li>
          <li>
            <Link href='#'>Sign In</Link>
          </li>
        </ul>
      </div>
    </>
  );
};

export default Navbar;
