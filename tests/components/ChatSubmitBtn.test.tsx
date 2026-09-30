import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatSubmitBtn } from "@/Components/ui/ChatSubmitBtn";

describe("ChatSubmitBtn", () => {
  it.each([
    [false, false, "Submit", false],
    [false, true, "Submit", true],
    [true, false, "Stop", false],
    // the prompt is empty while busy, Stop must still work
    [true, true, "Stop", false],
  ])(
    "isBusy=%s disabled=%s -> %s, disabled=%s",
    (isBusy, disabled, text, isDisabled) => {
      render(
        <ChatSubmitBtn isBusy={isBusy} disabled={disabled} onStop={vi.fn()} />,
      );
      const button = screen.getByRole("button");
      expect(button).toHaveTextContent(text);
      if (isDisabled) expect(button).toBeDisabled();
      else expect(button).toBeEnabled();
    },
  );

  it("Submit submits the form", () => {
    render(<ChatSubmitBtn isBusy={false} disabled={false} onStop={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("Stop calls onStop and does not submit the form", async () => {
    const onStop = vi.fn();
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <ChatSubmitBtn isBusy disabled onStop={onStop} />
      </form>,
    );

    const button = screen.getByRole("button", { name: "Stop" });
    expect(button).toHaveAttribute("type", "button");
    await userEvent.click(button);

    expect(onStop).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
