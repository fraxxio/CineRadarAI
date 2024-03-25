import React from "react";

export const SelectYear = () => {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1887 }, (_, index) => currentYear - index);

  return (
    <select
      name='years'
      className='bg-dark-bg border border-border-clr p-2 rounded-sm focus:outline outline-primary-text outline-1 duration-200'
    >
      <option value='' className='bg-primary-text text-primary-bg last:rounded-md'>
        Choose year
      </option>
      {years.map((year) => {
        return (
          <option
            value={year}
            className='bg-primary-text text-primary-bg last:rounded-md'
            key={year}
          >
            {year}
          </option>
        );
      })}
    </select>
  );
};
