import { SignOut } from "@/app/actions";
import { LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import DeleteModal from "./ui/DeleteModal";

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
    return <Link href="/signin">Sign In</Link>;
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
        className={`absolute right-0 top-[4.2rem] w-max rounded-sm rounded-tr-none border border-border-clr bg-primary-bg px-3 py-2 text-right ${isOpen ? "block" : "hidden"}`}
      >
        <span
          style={{
            position: "absolute",
            top: "-20.5px",
            right: "-0.5px",
            width: "0",
            height: "0",
            borderLeft: "20px solid transparent",
            borderRight: "20px solid transparent",
            borderBottom: "20px solid #0E1428",
            zIndex: "2",
          }}
        ></span>
        <span
          style={{
            position: "absolute",
            top: "-20.5px",
            right: "-0.5px",
            width: "0",
            height: "0",
            borderLeft: "20px solid transparent",
            borderRight: "20px solid transparent",
            borderBottom: "20px solid rgba(39, 195, 233, 0.6)",
          }}
        ></span>
        <div className="flex w-full justify-between gap-2">
          <p className="text-lg">Logged in as:</p>
          <p className="text-lg">{user.name}</p>
        </div>
        <p className="pt-1">{user.email}</p>
        <DeleteModal id={user.id} />
        <form action={SignOut}>
          <button
            type="submit"
            className="mt-3 flex w-full items-center justify-center gap-2  rounded-md duration-300 hover:bg-primary-text hover:text-dark-bg"
          >
            Sign Out
            <LogOut size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
