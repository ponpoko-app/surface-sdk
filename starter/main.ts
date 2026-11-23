import { createSurfaceClient } from "@ponpoko-app/surface-sdk";
import { bindSurfaceTheme } from "@ponpoko-app/surface-sdk/theme";

if (window.parent !== window && new URLSearchParams(location.search).has("view")) {
  const host = createSurfaceClient();
  const unbindTheme = bindSurfaceTheme(host);
  void host.ready().catch(() => {
    const status = document.getElementById("host-status");
    if (status) {
      status.dataset.state = "error";
      status.textContent = "Ponpoko could not connect to this surface.";
    }
  });
  addEventListener(
    "pagehide",
    () => {
      unbindTheme();
      host.dispose();
    },
    { once: true },
  );
}
