import React from "react";

export const IncludeAdult = (props: React.HTMLProps<HTMLInputElement>) => {
  return (
    <label className="inline-flex cursor-pointer items-center">
      <input {...props} name="adult" type="checkbox" className="peer sr-only" />
      <div className="peer-focus:ring-3 relative h-6 w-11 rounded-full border-2 border-border-clr bg-dark-bg  after:absolute after:start-[2px]  after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-text peer-checked:after:translate-x-full peer-focus:outline-none peer-focus:ring-offset-primary-text rtl:peer-checked:after:-translate-x-full"></div>
      <span className="ms-3 text-sm font-medium">Include adult</span>
    </label>
  );
};
