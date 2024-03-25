import React from "react";

export const IncludeAdult = () => {
  return (
    <label className='inline-flex items-center cursor-pointer'>
      <input name='adult' type='checkbox' className='sr-only peer' />
      <div className="relative w-11 h-6 peer-focus:outline-none peer-focus:ring-3 peer-focus:ring-offset-primary-text rounded-full bg-dark-bg  peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full  after:content-[''] after:absolute after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-text border-2 border-border-clr"></div>
      <span className='ms-3 text-sm font-medium'>Include adult</span>
    </label>
  );
};
