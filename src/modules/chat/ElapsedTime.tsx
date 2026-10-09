"use client";
import { useEffect, useState } from "react";
import { formatElapsed } from "./messageParts";

const TICK_MS = 100;

type ElapsedTimeProps = {
  // time of the finished stretches
  elapsedMs: number;
  // client time the current stretch began; undefined when not running
  runningSince?: number;
};

// ticks on its own so only this span re-renders, not the chat
export function ElapsedTime({ elapsedMs, runningSince }: ElapsedTimeProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (runningSince === undefined) {
      return;
    }
    const interval = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(interval);
  }, [runningSince]);

  const running = runningSince === undefined ? 0 : Date.now() - runningSince;

  // hidden: a live region would announce every tick
  return <span aria-hidden>{formatElapsed(elapsedMs + running)}</span>;
}
