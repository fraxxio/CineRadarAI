import React, { ButtonHTMLAttributes } from "react";

type ListSortBtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  withIcon?: boolean;
  name?: string;
  isChecked?: boolean;
};

export default function ListSortBtn({
  children,
  withIcon = false,
  name,
  isChecked,
  ...props
}: ListSortBtnProps) {
  return (
    <button
      {...props}
      name={name}
      disabled={isChecked}
      className={`mr-2 rounded-md border border-border-clr bg-dark-bg px-2 py-1 duration-200 hover:bg-primary-text hover:text-dark-bg disabled:bg-primary-text disabled:text-dark-bg
      ${withIcon && "flex items-center gap-2"}
      `}
    >
      {children}
    </button>
  );
}
