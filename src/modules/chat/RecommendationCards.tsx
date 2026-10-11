import type { RecommendedTitle } from "./protocol";
import { RecommendationCard } from "./RecommendationCard";

type RecommendationCardsProps = {
  items: RecommendedTitle[];
  signedIn: boolean;
};

export function RecommendationCards({
  items,
  signedIn,
}: RecommendationCardsProps) {
  return (
    <ul
      aria-label="Recommendations"
      className="grid grid-cols-1 gap-3 py-2 lg:grid-cols-2"
    >
      {items.map((item) => (
        // movie and TV ids can collide
        <li key={`${item.type}-${item.id}`}>
          <RecommendationCard title={item} signedIn={signedIn} />
        </li>
      ))}
    </ul>
  );
}
