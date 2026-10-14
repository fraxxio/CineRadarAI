// the longest title a save or the list-change note takes
export const MAX_TITLE_LENGTH = 300;

// anything but letters and digits, in any script; a literal /u regex fails
// tsc's default ES5 target, the runtimes support it
const NOT_LETTER_OR_DIGIT = new RegExp("[^\\p{L}\\p{N}]", "gu");

// ignores case, accents, spaces and punctuation: "Ford v. Ferrari" matches
// "Ford v Ferrari"
export const titleKey = (title: string) =>
  title.normalize("NFKD").replace(NOT_LETTER_OR_DIGIT, "").toLowerCase();

// the name the model gave is the TMDB title, or its original title; a name
// without letters or digits matches nothing, not a missing original title
export const matchesTitle = (
  name: string,
  title: { title: string; originalTitle: string },
) => {
  const key = titleKey(name);
  return (
    key !== "" &&
    (key === titleKey(title.title) || key === titleKey(title.originalTitle))
  );
};
