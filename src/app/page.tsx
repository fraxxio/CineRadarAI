import Trending from "@/Components/Trending";
import DeleteResult from "@/Components/ui/DeleteResult";
import { toast } from "sonner";

export default function Home({
  searchParams,
}: {
  searchParams: { deleteAcc: string };
}) {
  return (
    <main className="container flex flex-col justify-between gap-20 py-20">
      <DeleteResult deleteAcc={searchParams.deleteAcc} />
      <Trending />
    </main>
  );
}
