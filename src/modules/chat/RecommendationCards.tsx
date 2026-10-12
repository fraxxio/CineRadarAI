import { memo } from "react";
import { listKey, type ListStatuses } from "./messageParts";
import type { RecommendedTitle } from "./protocol";
import { RecommendationCard } from "./RecommendationCard";

type RecommendationCardsProps = {
  items: RecommendedTitle[];
  signedIn: boolean;
  listStatus: ListStatuses;
};

// memo: every streamed delta re-renders the chat, and a cards part keeps its
// items array (and listStatus only changes with a save), so the cards render
// once
export const RecommendationCards = memo(function RecommendationCards({
  items,
  signedIn,
  listStatus,
}: RecommendationCardsProps) {
  return (
    <ul
      aria-label="Recommendations"
      className="grid grid-cols-1 gap-3 py-2 lg:grid-cols-2"
    >
      {items.map((item) => (
        // movie and TV ids can collide
        <li key={`${item.type}-${item.id}`}>
          <RecommendationCard
            title={item}
            signedIn={signedIn}
            listStatus={listStatus.get(listKey(item.type, item.id))}
          />
        </li>
      ))}
    </ul>
  );
});
