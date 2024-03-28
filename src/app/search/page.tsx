import Filters from "@/Components/Filters";
import SearchResults from "@/Components/SearchResults";

export default function page() {
  return (
    <main className='container flex gap-12 py-20 max-lg:flex-col'>
      <Filters />
      <SearchResults />
    </main>
  );
}
