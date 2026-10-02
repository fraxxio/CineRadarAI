import Link from "next/link";
import ListSortBtn, { listSortBtnClassName } from "./ListSortBtn";

type ListSortLinkProps = {
  href: string;
  isActive: boolean;
  children: React.ReactNode;
};

export default function ListSortLink({
  href,
  isActive,
  children,
}: ListSortLinkProps) {
  if (isActive) {
    return <ListSortBtn isChecked>{children}</ListSortBtn>;
  }

  return (
    <Link href={href} className={listSortBtnClassName}>
      {children}
    </Link>
  );
}
