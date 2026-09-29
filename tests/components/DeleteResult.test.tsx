import { render } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";
import DeleteResult from "@/Components/ui/DeleteResult";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("DeleteResult", () => {
  test("success -> one success toast", () => {
    render(<DeleteResult deleteAcc="success" />);
    vi.runAllTimers();

    expect(toast.success).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith(
      "Account deleted succesfully.",
      expect.anything(),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  test("fail -> one error toast", () => {
    render(<DeleteResult deleteAcc="fail" />);
    vi.runAllTimers();

    expect(toast.error).toHaveBeenCalledOnce();
    expect(toast.error).toHaveBeenCalledWith(
      "Failed to delete account.",
      expect.anything(),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it.each([undefined, "other"])("%s -> no toast", (deleteAcc) => {
    render(<DeleteResult deleteAcc={deleteAcc as string} />);
    vi.runAllTimers();

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  test("[B12] a re-render doesn't show the toast again", () => {
    const { rerender } = render(<DeleteResult deleteAcc="success" />);
    vi.runAllTimers();
    rerender(<DeleteResult deleteAcc="success" />);
    vi.runAllTimers();

    expect(toast.success).toHaveBeenCalledOnce();
  });
});
