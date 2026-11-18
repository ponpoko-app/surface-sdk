import { createSurfaceClient } from "@zurge-co/ponpoko-surface-sdk";
import { bindSurfaceTheme } from "@zurge-co/ponpoko-surface-sdk/theme";
import { setFieldError, setStatus } from "@zurge-co/ponpoko-surface-sdk/ui";
import { saveNote } from "./note.ts";

const form = document.querySelector<HTMLFormElement>("#capture")!;
const note = document.querySelector<HTMLTextAreaElement>("#note")!;
const error = document.querySelector<HTMLElement>("#note-error")!;
const status = document.querySelector<HTMLElement>("#save-status")!;

try { note.value = localStorage.getItem("note") ?? ""; }
catch { setStatus(status, "error", "The saved note is unavailable."); }

note.addEventListener("input", () => {
  setFieldError(note, error, "");
  setStatus(status, "idle", "");
});

form.addEventListener("submit", event => {
  event.preventDefault();
  if (!note.value.trim()) {
    setFieldError(note, error, "Write a note before saving.");
    note.focus();
    return;
  }
  try {
    saveNote(localStorage, note.value);
    setStatus(status, "success", "Note saved.");
  } catch {
    setStatus(status, "error", "The note could not be saved. Your draft is here. Try again.");
  }
});

if (window.parent !== window && new URLSearchParams(location.search).has("view")) {
  const host = createSurfaceClient();
  const unbind = bindSurfaceTheme(host);
  void host.ready().catch(() => setStatus(status, "error", "Ponpoko could not connect to this surface."));
  addEventListener("pagehide", () => { unbind(); host.dispose(); }, { once: true });
}
