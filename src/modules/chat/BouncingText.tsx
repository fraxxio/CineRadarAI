const STEP_MS = 60;

type BouncingTextProps = {
  text: string;
};

// letters bounce one after another; keyed by the text so a new text restarts
// the animation
export function BouncingText({ text }: BouncingTextProps) {
  return (
    <span key={text} aria-hidden>
      {Array.from(text).map((char, i) => (
        <span
          key={i}
          className="inline-block animate-letter-bounce motion-reduce:animate-none"
          style={{ animationDelay: `${i * STEP_MS}ms` }}
        >
          {/* a non-breaking space keeps its width in an inline-block */}
          {char === " " ? "\u00a0" : char}
        </span>
      ))}
    </span>
  );
}
