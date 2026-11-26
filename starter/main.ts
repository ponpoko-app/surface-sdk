import { createSurfaceClient } from "@ponpoko-app/surface-sdk";
import { bindSurfaceTheme } from "@ponpoko-app/surface-sdk/theme";

function showBanner(message: string): void {
  const banner = document.getElementById("host-banner");
  if (!banner) return;
  banner.textContent = message;
  banner.hidden = false;
}

function markReady(state: "true" | "error" = "true"): void {
  document.documentElement.dataset.ppReady = state;
}

window.addEventListener("error", (event) => {
  showBanner(event.message || "Unexpected error while running this surface.");
  markReady("error");
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason ?? "Unexpected error");
  showBanner(reason);
  markReady("error");
});

async function boot(): Promise<void> {
  const hosted = window.parent !== window && new URLSearchParams(location.search).has("view");
  if (!hosted) {
    markReady("true");
    return;
  }
  const host = createSurfaceClient();
  const unbindTheme = bindSurfaceTheme(host);
  addEventListener(
    "pagehide",
    () => {
      unbindTheme();
      host.dispose();
    },
    { once: true },
  );
  try {
    await host.ready();
    markReady("true");
  } catch {
    const status = document.getElementById("host-status");
    if (status) {
      status.dataset.state = "error";
      status.textContent = "Ponpoko could not connect to this surface.";
    }
    showBanner("Ponpoko could not connect to this surface.");
    markReady("error");
  }
}

void boot();
