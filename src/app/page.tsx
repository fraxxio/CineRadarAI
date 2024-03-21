import Filters from "@/Components/Filters";
import Trending from "@/Components/Trending";

export default function Home() {
  return (
    <main className='container flex flex-col justify-between gap-20 py-20'>
      <Filters />
      <Trending />
    </main>
  );
}
