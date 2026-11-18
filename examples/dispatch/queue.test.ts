import { expect, test } from "bun:test";
import { addJob, sample, toggleJob } from "./queue.ts";

test("intake trims the job, rejects an empty title and preserves the existing queue", () => {
  expect(() => addJob(sample, "  ", "Studio", "new")).toThrow("Enter a job");
  const next = addJob(sample, "  Check plates  ", "Studio", "new");
  expect(next.at(-1)).toEqual({ id: "new", name: "Check plates", lane: "Studio", done: false });
  expect(sample.find(job => job.id === "new")).toBeUndefined();
});

test("only the selected job is completed and can be reopened", () => {
  const next = toggleJob(sample, "proofs");
  expect(next[0].done).toBe(true);
  expect(next.slice(1)).toEqual(sample.slice(1));
  expect(toggleJob(next, "proofs")).toEqual(sample);
});
