import { getNewURL } from "@/lib/utils";
import Link from "next/link";

type PageBtnProps = {
  current?: boolean;
  value: number;
  filterValues: object;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export const PageBtn = ({
  current,
  value,
  filterValues,
  ...props
}: PageBtnProps) => {
  return (
    <Link href={getNewURL({ newPage: value, filterValues })}>
      <button
        {...props}
        disabled={current}
        className={`rounded-sm border border-border-clr px-2 py-1 duration-300 hover:border-primary-text ${
          current ? "bg-primary-text text-dark-bg" : "bg-primary-bg"
        }`}
      >
        {value}
      </button>
    </Link>
  );
};
