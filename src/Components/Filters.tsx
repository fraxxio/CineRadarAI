import SubmitBtn from "./ui/SubmitBtn";
import { IncludeAdult } from "./ui/IncludeAdult";
import { SelectYear } from "./ui/SelectYear";
import LangSelect from "./ui/LangSelect";
import { fetchMovies } from "@/app/actions";

const Filters = () => {
  return (
    <aside className="sticky top-20 h-fit rounded-sm border border-border-clr bg-primary-bg px-4 py-8 max-lg:w-full lg:max-w-[22rem]">
      <h1 className="pb-12 text-center text-xl font-semibold">
        Apply filters to search
      </h1>
      <form
        action={fetchMovies}
        className="flex w-full flex-col gap-4 max-lg:items-center"
      >
        <input
          name="query"
          placeholder="Type keywords..."
          required
          className="w-full rounded-sm border border-border-clr bg-dark-bg p-3 placeholder-primary-text placeholder-opacity-45 outline-none focus:border-transparent focus:ring focus:ring-primary-text"
        />
        <LangSelect />
        <SelectYear />
        <IncludeAdult />
        <div className="mx-auto flex items-center gap-4 pt-4 max-[415px]:flex-col max-[415px]:gap-2">
          <SubmitBtn text="Search movies" searchTarget="movie" />
          <p className="text-lg font-medium">or</p>
          <SubmitBtn text="Search TV shows" searchTarget="tv" />
        </div>
      </form>
    </aside>
  );
};

export default Filters;
