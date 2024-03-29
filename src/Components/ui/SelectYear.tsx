import React from "react";

export const SelectYear = () => {
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - 1887 },
    (_, index) => currentYear - index,
  );

  return (
    <select
      name="year"
      className="rounded-sm border border-border-clr bg-dark-bg p-2 outline-1 outline-primary-text duration-200 focus:outline max-lg:w-[12rem] max-[480px]:w-full"
    >
      <option
        value=""
        className="bg-primary-text text-primary-bg last:rounded-md"
      >
        Choose year
      </option>
      {years.map((year) => {
        return (
          <option
            value={year}
            className="bg-primary-text text-primary-bg last:rounded-md"
            key={year}
          >
            {year}
          </option>
        );
      })}
    </select>
  );
};
