"use client";
import { useEffect, useState } from "react";

const STEP_MS = 60;
const ROTATE_MS = 4000;

type ThinkingLoaderProps = {
  words: string[];
  startIndex: number;
};

export function ThinkingLoader({ words, startIndex }: ThinkingLoaderProps) {
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    const interval = setInterval(() => setIndex((i) => i + 1), ROTATE_MS);
    return () => clearInterval(interval);
  }, []);

  const word = words[index % words.length];

  return (
    <p role="status" aria-label="Generating response" className="italic">
      <span key={word} aria-hidden>
        {Array.from(word).map((char, i) => (
          <span
            key={i}
            className="inline-block animate-letter-bounce motion-reduce:animate-none"
            style={{ animationDelay: `${i * STEP_MS}ms` }}
          >
            {char === " " ? " " : char}
          </span>
        ))}
      </span>
    </p>
  );
}
