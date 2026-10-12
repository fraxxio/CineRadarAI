import Link from "next/link";
import { signInWithProvider } from "@/modules/account/actions";
import { SignInButtons } from "@/shared/ui/SignInButtons";
import type { PendingSave } from "./protocol";
import { SmallPoster } from "./SmallPoster";
import type { StartSignIn } from "./useChat";

type SignInCardProps = {
  saves: PendingSave[];
  onSignIn: StartSignIn;
};

const SIGN_IN_PATH = "/signin?callbackUrl=/";

// the titles a signed-out user asked to save; a click keeps them with the
// chat, which is restored after signing in, and they're saved then
export function SignInCard({ saves, onSignIn }: SignInCardProps) {
  const [first] = saves;
  const single = saves.length === 1;
  const startSignIn = () => onSignIn(saves);

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
        <SignInButtons
          action={signInWithProvider}
          callbackUrl="/"
          compact
          onClick={startSignIn}
        />
        <Link
          href={SIGN_IN_PATH}
          onClick={startSignIn}
          className="self-start text-sm text-secondary-text underline duration-200 hover:text-primary-text"
        >
          Other sign-in options
        </Link>
      </div>
    </div>
  );
}
