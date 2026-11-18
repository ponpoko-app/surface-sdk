import { expect, test } from "bun:test";
import { sample, saveEntry } from "./notebook.ts";

test("editing updates the same entry and persists the exact returned notebook", () => {
  let saved = "";
  const next = saveEntry(sample, { ...sample[1], title: "  River level  " }, { setItem: (_, value) => { saved = value; } });
  expect(JSON.parse(saved)).toEqual(next);
  expect(next).toHaveLength(sample.length);
  expect(next[1].title).toBe("River level");
  expect(next[1].id).toBe(sample[1].id);
});

test("a failed write leaves the existing entries intact", () => {
  const original = JSON.stringify(sample);
  expect(() => saveEntry(sample, { ...sample[1], body: "new text" }, { setItem() { throw new Error("storage full"); } })).toThrow("storage full");
  expect(JSON.stringify(sample)).toBe(original);
});
