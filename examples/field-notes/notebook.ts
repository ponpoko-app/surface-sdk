export interface Entry { id: string; date: string; title: string; body: string }

export const sample: Entry[] = [
  {
    id: "north-bank", date: "2026-10-18", title: "The north bank",
    body: "The water had pulled back from the reeds overnight. A row of pale stones marked where the current ran yesterday. Two herons held the bend until the first boat came through.\n\nStart tomorrow’s walk at the footbridge. Bring the larger notebook and leave room for the waterline sketch.",
  },
  {
    id: "flood-mark", date: "2026-10-16", title: "After the rain",
    body: "The flood mark reached the lower bolt on the footbridge. Follow the path from the upper gate while the bank is soft.",
  },
  {
    id: "willow", date: "2026-10-12", title: "Willow bend",
    body: "Fresh shoots have grown through the driftwood. The long branch downstream makes a reliable reference point for the next sketch.",
  },
];

export function saveEntry(entries: Entry[], draft: Entry, storage: Pick<Storage, "setItem">): Entry[] {
  const title = draft.title.trim();
  const body = draft.body.trim();
  if (!title || !body) throw new Error("An entry needs a title and observation.");
  const entry = { ...draft, title, body };
  const next = entries.some(row => row.id === entry.id)
    ? entries.map(row => row.id === entry.id ? entry : row)
    : [entry, ...entries];
  storage.setItem("field-notebook", JSON.stringify(next));
  return next;
}
