import { createSurfaceClient } from "@ponpoko-app/surface-sdk";

if (window.parent !== window && new URLSearchParams(location.search).has("view")) {
  const host = createSurfaceClient();
  void host.ready().catch(() => {
    const status = document.getElementById("host-status");
    if (status) status.textContent = "Ponpoko could not connect to this surface.";
  });
  addEventListener("pagehide", () => host.dispose(), { once: true });
}
