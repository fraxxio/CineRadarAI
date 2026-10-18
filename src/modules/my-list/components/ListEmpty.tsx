import Link from "next/link";

type ListEmptyProps = {
  // true when the list has titles but none match the view
  filtered: boolean;
  chatEnabled: boolean;
};

const linkClassName = "text-primary-text underline hover:no-underline";

export default function ListEmpty({ filtered, chatEnabled }: ListEmptyProps) {
  return (
    <div className="flex flex-col items-center gap-2 border-t border-border-clr px-4 py-12 text-center">
      {filtered ? (
        <>
          <p className="text-lg font-medium">No titles match these filters.</p>
          <Link href="/my-list" className={linkClassName}>
            Reset filters
          </Link>
        </>
      ) : (
        <>
          <p className="text-lg font-medium">Your list is empty.</p>
          <p>
            <Link href="/search" className={linkClassName}>
              Search for a movie or TV show
            </Link>{" "}
            to add it.
          </p>
          {chatEnabled && (
            <p className="text-secondary-text">
              Or{" "}
              <Link href="/" className={linkClassName}>
                ask the chat
              </Link>{" "}
              for recommendations.
            </p>
          )}
        </>
      )}
    </div>
  );
}
