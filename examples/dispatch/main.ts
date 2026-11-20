import { createSurfaceClient } from "@ponpoko-app/surface-sdk";
import type { InferenceRequest } from "@ponpoko-app/surface-sdk/ai";
import { bindSurfaceTheme } from "@ponpoko-app/surface-sdk/theme";
import { setButtonBusy, setFieldError, setStatus } from "@ponpoko-app/surface-sdk/ui";
import { addJob, sample, toggleJob, type Job } from "./queue.ts";

const rows = document.querySelector<HTMLTableSectionElement>("#rows")!;
const form = document.querySelector<HTMLFormElement>("#job-form")!;
const name = document.querySelector<HTMLInputElement>("#job")!;
const lane = document.querySelector<HTMLSelectElement>("#lane")!;
const error = document.querySelector<HTMLElement>("#job-error")!;
const status = document.querySelector<HTMLElement>("#status")!;
const empty = document.querySelector<HTMLElement>("#empty")!;
const summary = document.querySelector<HTMLElement>("#summary")!;
const all = document.querySelector<HTMLButtonElement>("#all")!;
const open = document.querySelector<HTMLButtonElement>("#open")!;
const check = document.querySelector<HTMLButtonElement>("#check-host")!;
let jobs: Job[] = sample;
let showAll = new URL(location.href).searchParams.get("filter") === "all";
let canSave = true;
check.hidden = true;

try { jobs = JSON.parse(localStorage.getItem("dispatch-jobs") ?? "null") ?? sample; }
catch { canSave = false; setStatus(status, "error", "The saved queue could not be loaded. Reload to try again."); }

function render(focusId?: string) {
  all.disabled = showAll;
  open.disabled = !showAll;
  all.setAttribute("aria-pressed", String(showAll));
  open.setAttribute("aria-pressed", String(!showAll));
  const visible = jobs.filter(job => showAll || !job.done);
  summary.textContent = `${jobs.filter(job => !job.done).length} open of ${jobs.length} jobs`;
  empty.hidden = visible.length > 0;
  rows.replaceChildren();
  let newFocus: HTMLButtonElement | undefined;
  for (const job of visible) {
    const row = rows.insertRow();
    row.dataset.done = String(job.done);
    for (const value of [job.name, job.lane, job.done ? "Complete" : "Open"]) row.insertCell().textContent = value;
    const button = document.createElement("button");
    button.className = "pp-button";
    button.textContent = job.done ? "Reopen" : "Complete";
    button.setAttribute("aria-label", `${button.textContent} ${job.name}`);
    button.addEventListener("click", () => commit(toggleJob(jobs, job.id), job.id));
    row.insertCell().append(button);
    if (job.id === focusId) newFocus = button;
  }
  if (focusId) (newFocus ?? rows.querySelector("button") ?? all).focus();
}

function commit(next: Job[], focusId?: string) {
  try {
    if (!canSave) throw new Error("The queue could not be loaded");
    localStorage.setItem("dispatch-jobs", JSON.stringify(next));
    jobs = next;
    render(focusId);
    setStatus(status, "success", "Queue saved.");
    return true;
  } catch {
    setStatus(status, "error", "The queue could not be saved. Your changes are still on this screen. Try again.");
    return false;
  }
}

function filter(allJobs: boolean) {
  showAll = allJobs;
  const url = new URL(location.href);
  if (showAll) url.searchParams.set("filter", "all");
  else url.searchParams.delete("filter");
  history.replaceState(null, "", url);
  render();
  document.querySelector<HTMLElement>("#queue-heading")?.focus();
}

open.addEventListener("click", () => filter(false));
all.addEventListener("click", () => filter(true));
name.addEventListener("input", () => setFieldError(name, error, ""));
form.addEventListener("submit", event => {
  event.preventDefault();
  if (!name.value.trim()) { setFieldError(name, error, "Enter a job name."); name.focus(); return; }
  if (commit(addJob(jobs, name.value, lane.value, crypto.randomUUID()))) name.value = "";
  name.focus();
});

render();

if (window.parent !== window && new URLSearchParams(location.search).has("view")) {
  check.hidden = false;
  const host = createSurfaceClient();
  const unbind = bindSurfaceTheme(host);
  void host.ready().catch(() => setStatus(status, "error", "Ponpoko could not connect. Use Check connection to retry."));
  check.addEventListener("click", async () => {
    setButtonBusy(check, true, "Check connection", "Checking…");
    setStatus(status, "loading", "Checking the Host connection…");
    try {
      const info = await host.call("host.platform", "protocol.info");
      const sample: InferenceRequest = {
        request_id: "dispatch-validation", io: { inputs: ["text"], outputs: ["text"] },
        input: [{ type: "text", text: "Summarize the dispatch queue." }],
        budget: { seconds: 10, output_bytes: 1024 },
      };
      const checked = await host.ai.validate(sample, true);
      setStatus(status, "success", `Host protocol ${info.protocol}, AI contract ${checked.contract_version} validated`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The Host could not be reached.";
      setStatus(status, "error", `${detail} Try Check connection again.`);
    } finally { setButtonBusy(check, false, "Check connection", "Checking…"); }
  });
  addEventListener("pagehide", () => { unbind(); host.dispose(); }, { once: true });
}
