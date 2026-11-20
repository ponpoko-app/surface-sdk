import { createSurfaceClient } from "@ponpoko-app/surface-sdk";
import { bindSurfaceTheme } from "@ponpoko-app/surface-sdk/theme";
import { setFieldError, setStatus } from "@ponpoko-app/surface-sdk/ui";
import { sample, saveEntry, type Entry } from "./notebook.ts";

function element<T extends HTMLElement>(id: string) { return document.getElementById(id) as T; }

const entries = element<HTMLUListElement>("entries");
const reading = element("reading");
const editor = element<HTMLFormElement>("writing");
const title = element<HTMLInputElement>("title");
const body = element<HTMLTextAreaElement>("entry");
const titleError = element("title-error");
const bodyError = element("entry-error");
const status = element("status");
const add = element<HTMLButtonElement>("new-entry");
let notes: Entry[] = sample;
let selected: Entry | undefined;
let draft: Entry | undefined;
let recoverable: Entry | undefined;
let canSave = true;

try { notes = JSON.parse(localStorage.getItem("field-notebook") ?? "null") ?? sample; }
catch { canSave = false; setStatus(status, "error", "The notebook could not be loaded. Reload to retry."); }

function read(id?: string) {
  selected = notes.find(note => note.id === id) ?? notes[0];
  editor.hidden = true;
  reading.hidden = !selected;
  element("empty").hidden = notes.length !== 0;
  entries.replaceChildren();
  for (const note of notes) {
    const item = document.createElement("li");
    if (note.id === selected?.id) {
      const current = document.createElement("span");
      current.className = "pp-button";
      current.textContent = note.title;
      current.tabIndex = -1;
      current.setAttribute("aria-current", "true");
      item.append(current);
    } else {
      const button = document.createElement("button");
      button.className = "pp-button";
      button.textContent = note.title;
      button.addEventListener("click", () => {
        read(note.id);
        entries.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
      });
      item.append(button);
    }
    entries.append(item);
  }
  if (!selected) return;
  const date = element<HTMLTimeElement>("date");
  date.dateTime = selected.date;
  date.textContent = new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(new Date(selected.date));
  element("entry-title").textContent = selected.title;
  element("body").replaceChildren(...selected.body.split(/\n\s*\n/).map(text => {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    return paragraph;
  }));
}

function write(entry?: Entry) {
  draft = recoverable ?? entry ?? { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), title: "", body: "" };
  recoverable = undefined;
  add.textContent = "New entry";
  add.disabled = true;
  for (const button of entries.querySelectorAll("button")) button.disabled = true;
  title.value = draft.title;
  body.value = draft.body;
  reading.hidden = true;
  editor.hidden = false;
  element("editor-title").textContent = notes.some(note => note.id === draft?.id) ? "Edit entry" : "New entry";
  setFieldError(title, titleError, "");
  setFieldError(body, bodyError, "");
  title.focus();
}

add.addEventListener("click", () => write());
element("edit-entry").addEventListener("click", () => write(selected));
element("cancel").addEventListener("click", () => {
  if (draft && (draft.title !== title.value || draft.body !== body.value)) {
    recoverable = { ...draft, title: title.value, body: body.value };
    add.textContent = "Resume draft";
    setStatus(status, "idle", "Draft kept on this screen.");
  }
  add.disabled = false;
  read(selected?.id);
  add.focus();
});
title.addEventListener("input", () => setFieldError(title, titleError, ""));
body.addEventListener("input", () => setFieldError(body, bodyError, ""));
editor.addEventListener("submit", event => {
  event.preventDefault();
  if (!draft) return;
  setFieldError(title, titleError, title.value.trim() ? "" : "Enter a title.");
  setFieldError(body, bodyError, body.value.trim() ? "" : "Write an observation.");
  if (!title.value.trim() || !body.value.trim()) { (!title.value.trim() ? title : body).focus(); return; }
  try {
    if (!canSave) throw new Error("The notebook could not be loaded");
    notes = saveEntry(notes, { ...draft, title: title.value, body: body.value }, localStorage);
    add.disabled = false;
    read(draft.id);
    setStatus(status, "success", "Entry saved.");
    element("edit-entry").focus();
  } catch { setStatus(status, "error", "The entry could not be saved. Your draft is here. Try Save entry again."); }
});

read();
if (window.parent !== window && new URLSearchParams(location.search).has("view")) {
  const host = createSurfaceClient();
  const unbind = bindSurfaceTheme(host);
  void host.ready().catch(() => setStatus(status, "error", "Ponpoko could not connect to this notebook."));
  addEventListener("pagehide", () => { unbind(); host.dispose(); }, { once: true });
}
