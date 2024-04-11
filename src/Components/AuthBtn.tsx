import { SignOut } from "@/app/actions";
import { LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type AuthBtnProps = {
  user:
    | {
        id: string;
        name: string;
        email: string;
        image: string;
      }
    | undefined;
};

export default function AuthBtn({ user }: AuthBtnProps) {
  if (user === undefined) {
    return <Link href="/sign-in">Sign In</Link>;
  }
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        ref.current &&
        !ref.current.contains(event.target as HTMLDivElement)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setIsOpen((prevState) => !prevState)}>
        <Image
          alt="Profile"
          width={35}
          height={35}
          src={user.image}
          className="rounded-full border-2 border-primary-text duration-300 hover:rotate-180"
        />
      </button>
      <div
        className={`absolute right-0 top-16 w-max rounded-sm rounded-tr-none bg-primary-text px-3 py-2 text-right ${isOpen ? "block" : "hidden"}`}
      >
        <span
          style={{
            position: "absolute",
            top: "-19px",
            right: "-0.5px",
            width: "0",
            height: "0",
            borderLeft: "20px solid transparent",
            borderRight: "20px solid transparent",
            borderBottom: "20px solid #0ba6cf",
          }}
        ></span>
        <div className="flex w-full justify-between">
          <p className="text-dark-bg">Logged in as:</p>
          <p className="text-dark-bg">{user.name}</p>
        </div>
        <p className="text-sm text-dark-bg">{user.email}</p>
        <form action={SignOut}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 pt-3 text-dark-bg duration-300 hover:text-red-800"
          >
            Sign Out
            <LogOut size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
