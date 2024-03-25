import { fetchMovies } from "@/app/actions";
import React from "react";
import SubmitBtn from "./ui/SubmitBtn";
import LangSelect from "./ui/LangSelect";
import { IncludeAdult } from "./ui/IncludeAdult";
import { SelectYear } from "./ui/SelectYear";

const Filters = () => {
  return (
    <section className='border border-border-clr bg-primary-bg rounded-sm px-4 py-8'>
      <h1 className='text-2xl font-semibold text-center pb-12'>
        Apply filters to generate recommendations
      </h1>
      <div>
        <form action={fetchMovies} className='flex flex-col gap-8 w-[80%] mx-auto'>
          <input
            name='query'
            placeholder='Type keywords...'
            className='bg-dark-bg p-3 rounded-sm border border-border-clr outline-none focus:ring focus:ring-primary-text focus:border-transparent placeholder-primary-text placeholder-opacity-45'
          />
          <div className='flex gap-4 items-center justify-center'>
            <LangSelect />
            <SelectYear />
            <IncludeAdult />
          </div>
          <div className='mx-auto flex items-center gap-4'>
            <SubmitBtn text='Search movies' searchTarget='movie' />
            <p className='font-medium text-lg'>or</p>
            <SubmitBtn text='Search TV shows' searchTarget='tv' />
          </div>
        </form>
      </div>
    </section>
  );
};

export default Filters;
