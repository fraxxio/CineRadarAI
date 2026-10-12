import Link from "next/link";
import type { PendingSave } from "./protocol";
import { SmallPoster } from "./SmallPoster";

type SignInCardProps = {
  saves: PendingSave[];
};

// the titles a signed-out user asked to save; the chat is kept for the
// session, so it's still there after signing in
export function SignInCard({ saves }: SignInCardProps) {
  const [first] = saves;
  const single = saves.length === 1;

  return (
    <div className="flex items-center gap-3 rounded-sm border border-border-clr bg-dark-bg p-3">
      {single && <SmallPoster path={first.posterPath} />}
      {/* min-w-0 and break-words keep long titles from widening the chat */}
      <div className="flex min-w-0 flex-col gap-2">
        {single ? (
          <p className="break-words">
            Sign in to add <b>{first.title}</b> to your list
          </p>
        ) : (
          <>
            <p>Sign in to add {saves.length} titles to your list</p>
            <ul className="list-disc break-words pl-5 text-sm">
              {saves.map((save) => (
                // movie and TV ids can collide
                <li key={`${save.type}-${save.id}`}>{save.title}</li>
              ))}
            </ul>
          </>
        )}
        <Link
          href="/signin?callbackUrl=/"
          className="self-start rounded-md border border-border-clr bg-primary-bg px-3 py-1 text-sm font-medium duration-200 hover:bg-primary-text hover:text-dark-bg"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
