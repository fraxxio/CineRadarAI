import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StatusBadge from "./StatusBadge";

describe("StatusBadge", () => {
  it.each([
    ["Watching", "lucide-eye", "text-emerald-300"],
    ["Planning to watch", "lucide-notebook-pen", "text-amber-300"],
    ["Completed", "lucide-circle-check", "text-sky-300"],
    ["Dropped", "lucide-notebook-pen", "text-slate-300"],
  ])("%s -> %s icon and %s", (status, icon, color) => {
    render(<StatusBadge status={status} />);
    const badge = screen.getByText(status);
    expect(badge).toHaveClass(color);
    expect(badge.querySelector(`svg.${icon}`)).not.toBeNull();
  });

  it("the icon is decorative, the text carries the status", () => {
    render(<StatusBadge status="Watching" />);
    expect(screen.getByText("Watching").querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
