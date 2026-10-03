import { SearchLoading } from "@/modules/search";

// not a client component: that would bundle the whole @/modules/search barrel,
// zod included, into the browser
export default function Loading() {
  return <SearchLoading />;
}
