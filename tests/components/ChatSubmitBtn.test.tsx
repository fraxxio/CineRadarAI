import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatSubmitBtn } from "@/Components/ui/ChatSubmitBtn";

describe("ChatSubmitBtn", () => {
  it.each([
    [false, false, "Submit", false],
    [true, false, "Generating...", true],
    [false, true, "Submit", true],
    [true, true, "Generating...", true],
  ])(
    "isLoading=%s disabled=%s -> %s, disabled=%s",
    (isLoading, disabled, text, isDisabled) => {
      render(<ChatSubmitBtn isLoading={isLoading} disabled={disabled} />);
      const button = screen.getByRole("button");
      expect(button).toHaveTextContent(text);
      if (isDisabled) expect(button).toBeDisabled();
      else expect(button).toBeEnabled();
    },
  );
});
