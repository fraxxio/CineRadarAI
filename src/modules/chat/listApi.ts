// the list routes the chat calls from the browser
import type { ListSavedPart, PendingSave } from "./protocol";

type SaveResult = Pick<ListSavedPart, "entry" | "previous">;

// saves a title the user asked for while signed out
export async function saveTitleRequest({
  type,
  id,
  title,
  status,
}: PendingSave): Promise<SaveResult> {
  const response = await fetch("/api/save-title", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, id, title, status }),
  });
  if (!response.ok) {
    throw new Error(`Save failed. (Status: ${response.status})`);
  }
  return response.json();
}

// puts the row back as it was before the save, through the list's own routes
export async function undoRequest({ entry, previous }: ListSavedPart) {
  const response =
    previous === null
      ? await fetch("/api/remove-from-list", {
          method: "DELETE",
          headers: { movieId: String(entry.id), type: entry.type },
        })
      : await fetch("/api/add-to-list", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            movieId: entry.id,
            title: previous.name,
            image: previous.image,
            status: previous.status,
            // 0 is "not rated", which the route takes as ""
            rating: previous.rating || "",
            type: entry.type,
          }),
        });
  // a DB error is a 200 with "fail"
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.addToListResult !== "success") {
    throw new Error(`Undo failed. (Status: ${response.status})`);
  }
}
