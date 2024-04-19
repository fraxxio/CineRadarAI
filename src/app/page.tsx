import Chat from "@/Components/Chat";
import DeleteResult from "@/Components/ui/DeleteResult";

export const runtime = "edge";
export default function Home({
  searchParams,
}: {
  searchParams: { deleteAcc: string };
}) {
  return (
    <main className="container py-10">
      <DeleteResult deleteAcc={searchParams.deleteAcc} />
      <Chat />
    </main>
  );
}
