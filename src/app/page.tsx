import OpenAIAssistant from "@/Components/OpenAIAssistant";
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
      <OpenAIAssistant greeting="Ask me for movie or TV show recommendations! Describe what you would like to watch: genre, actors, style, mood and other movie related criteria." />
    </main>
  );
}
