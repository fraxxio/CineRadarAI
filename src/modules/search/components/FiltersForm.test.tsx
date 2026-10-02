import { render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, test, vi } from "vitest";
import FiltersForm from "./FiltersForm";
import { IncludeAdult } from "./IncludeAdult";
import { SelectYear } from "./SelectYear";

let user: UserEvent;
beforeEach(() => {
  user = userEvent.setup();
});

// LangSelect is an async server component, so a plain select stands in for it
function renderForm() {
  render(
    <FiltersForm>
      <input name="query" aria-label="Query" defaultValue="  Fury  " />
      <select name="language" aria-label="Language" defaultValue="">
        <option value="">Choose language</option>
        <option value="fr">French</option>
      </select>
      <SelectYear aria-label="Year" defaultValue="" />
      <IncludeAdult />
    </FiltersForm>,
  );
}

// eslint-disable-next-line react-hooks/rules-of-hooks -- reads the mocked router, not a real hook call
const push = () => vi.mocked(useRouter().push);
const pushedParams = () =>
  Object.fromEntries(
    new URL(push().mock.lastCall![0], "http://x").searchParams,
  );

describe("FiltersForm", () => {
  it.each([
    ["Search movies", "movie"],
    ["Search TV shows", "tv"],
  ])("%s pushes btn=%s", async (name, btn) => {
    renderForm();
    await user.click(screen.getByRole("button", { name }));
    expect(push()).toHaveBeenCalledTimes(1);
    expect(push()).toHaveBeenCalledWith(`/search?query=Fury&btn=${btn}`);
  });

  test("includes every filter that is set", async () => {
    renderForm();
    await user.selectOptions(screen.getByLabelText("Language"), "fr");
    await user.selectOptions(screen.getByLabelText("Year"), "2014");
    await user.click(screen.getByText("Include adult"));
    await user.click(screen.getByRole("button", { name: "Search movies" }));

    expect(pushedParams()).toEqual({
      query: "Fury",
      language: "fr",
      year: "2014",
      adult: "true",
      btn: "movie",
    });
  });

  test("leaves out empty selects and an unticked checkbox", async () => {
    renderForm();
    await user.click(screen.getByRole("button", { name: "Search movies" }));
    expect(Object.keys(pushedParams())).toEqual(["query", "btn"]);
  });
});
