export function saveNote(storage: Pick<Storage, "setItem">, draft: string): string {
  const note = draft.trim();
  if (!note) throw new Error("Write a note before saving.");
  storage.setItem("note", note);
  return note;
}
