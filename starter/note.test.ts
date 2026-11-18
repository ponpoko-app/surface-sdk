import { expect, test } from "bun:test";
import { saveNote } from "./note.ts";

test("save persists normalized text under the note key", () => {
  const stored = new Map<string, string>();
  expect(saveNote({ setItem: (key, value) => stored.set(key, value) }, "  next draft  ")).toBe("next draft");
  expect([...stored]).toEqual([["note", "next draft"]]);
});

test("empty notes never write and failed writes never report success", () => {
  const storage = { setItem() { throw new Error("storage full"); } };
  expect(() => saveNote(storage, "  ")).toThrow("Write a note");
  expect(() => saveNote(storage, "draft")).toThrow("storage full");
});
