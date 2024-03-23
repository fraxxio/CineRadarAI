import { fetchMovies } from "@/app/actions";
import React from "react";
import SubmitBtn from "./ui/SubmitBtn";
import Combobox from "./ui/Combobox";

const Filters = () => {
  return (
    <section className='border border-border-clr bg-primary-bg rounded-sm p-4'>
      <h1 className='text-2xl font-semibold text-center pb-12 pt-4'>
        Apply filters to generate recommendations
      </h1>
      <div>
        <form action={fetchMovies} className='flex flex-col gap-8 w-[80%] mx-auto'>
          <textarea
            rows={1}
            name='description'
            placeholder='Movie about war, release must be after 2000s'
            className='bg-dark-bg p-3 rounded-sm border border-border-clr outline-none focus:ring focus:ring-primary-text focus:border-transparent placeholder-primary-text placeholder-opacity-45'
          />
          <div className='flex gap-4'>
            <Combobox />
            <Combobox />
          </div>
          <SubmitBtn />
        </form>
      </div>
    </section>
  );
};

export default Filters;
