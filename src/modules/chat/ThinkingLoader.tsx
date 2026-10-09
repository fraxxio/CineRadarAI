"use client";
import { useEffect, useState } from "react";
import { BouncingText } from "./BouncingText";

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

  return (
    <p role="status" className="italic">
      <span className="sr-only">Generating response</span>
      <BouncingText text={words[index % words.length]} />
    </p>
  );
}
