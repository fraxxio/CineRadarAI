"use client";
import { useEffect, useState } from "react";
import { BouncingText } from "./BouncingText";

const ROTATE_MS = 4000;

type ThinkingLoaderProps =
  // fixed text, e.g. the status of running tools
  | { text: string; words?: undefined; startIndex?: undefined }
  // rotating words; text, when set, shows instead of them
  | { words: string[]; startIndex: number; text?: string };

export function ThinkingLoader({
  words,
  startIndex = 0,
  text,
}: ThinkingLoaderProps) {
  const [index, setIndex] = useState(startIndex);
  const rotating = words !== undefined;

  useEffect(() => {
    if (!rotating) {
      return;
    }
    const interval = setInterval(() => setIndex((i) => i + 1), ROTATE_MS);
    return () => clearInterval(interval);
  }, [rotating]);

  const shown = text || (words ? words[index % words.length] : "");

  return (
    <p role="status" className="italic">
      <span className="sr-only">{text || "Generating response"}</span>
      <BouncingText text={shown} />
    </p>
  );
}
