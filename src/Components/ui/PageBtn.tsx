type PageBtnProps = {
  current?: boolean;
  value: number;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export const PageBtn = ({ current, value, ...props }: PageBtnProps) => {
  return (
    <button
      {...props}
      type="submit"
      name="page"
      value={value}
      disabled={current}
      className={`rounded-sm border border-border-clr px-2 py-1 duration-300 hover:border-primary-text ${
        current ? "bg-primary-text text-dark-bg" : "bg-primary-bg"
      }`}
    >
      {value}
    </button>
  );
};
