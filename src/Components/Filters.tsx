import SubmitBtn from "./ui/SubmitBtn";
import { IncludeAdult } from "./ui/IncludeAdult";
import { SelectYear } from "./ui/SelectYear";
import LangSelect from "./ui/LangSelect";
import { fetchMovies } from "@/app/actions";

type FiltersProps = {
  fetchTMDB: (formData: FormData) => void;
};

const Filters = () => {
  return (
    <aside className='border sticky border-border-clr bg-primary-bg rounded-sm px-4 py-8 lg:max-w-[22rem] max-lg:w-full'>
      <h1 className='text-xl font-semibold text-center pb-12'>
        Apply filters to generate recommendations
      </h1>
      <form action={fetchMovies} className='flex flex-col gap-4 w-full max-lg:items-center'>
        <input
          name='query'
          placeholder='Type keywords...'
          className='bg-dark-bg p-3 rounded-sm border border-border-clr outline-none focus:ring focus:ring-primary-text focus:border-transparent placeholder-primary-text placeholder-opacity-45 w-full'
        />
        <LangSelect />
        <SelectYear />
        <IncludeAdult />
        <div className='mx-auto flex items-center gap-4 pt-4 max-[415px]:flex-col max-[415px]:gap-2'>
          <SubmitBtn text='Search movies' searchTarget='movie' />
          <p className='font-medium text-lg'>or</p>
          <SubmitBtn text='Search TV shows' searchTarget='tv' />
        </div>
      </form>
    </aside>
  );
};

export default Filters;
