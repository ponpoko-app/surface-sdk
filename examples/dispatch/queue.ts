export interface Job { id: string; name: string; lane: string; done: boolean }

export const sample: Job[] = [
  { id: "proofs", name: "Approve risograph proofs", lane: "Studio", done: false },
  { id: "stock", name: "Count A3 cover stock", lane: "Intake", done: false },
  { id: "labels", name: "Print courier labels", lane: "Delivery", done: false },
  { id: "folds", name: "Fold the venue guides", lane: "Studio", done: false },
  { id: "crates", name: "Pack sample crates", lane: "Delivery", done: false },
  { id: "brief", name: "File the print brief", lane: "Intake", done: true },
];

export function addJob(jobs: Job[], name: string, lane: string, id: string): Job[] {
  if (!name.trim()) throw new Error("Enter a job name.");
  return [...jobs, { id, name: name.trim(), lane, done: false }];
}

export function toggleJob(jobs: Job[], id: string): Job[] {
  return jobs.map(job => job.id === id ? { ...job, done: !job.done } : job);
}
