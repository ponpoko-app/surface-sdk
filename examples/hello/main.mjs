import { createSurfaceClient } from "./sdk/surface.mjs";
let client;
try {
  client = createSurfaceClient();
  client.onPalette(tokens => { for (const [key, value] of Object.entries(tokens)) document.documentElement.style.setProperty(key, value); });
  const evidence = await client.checkCompatibility();
  document.querySelector("#status").textContent = "Host protocol matched. AI inference and visual behavior remain unmeasured.";
  document.querySelector("#evidence").textContent = JSON.stringify(evidence, null, 2);
} catch (error) {
  document.querySelector("#status").textContent = `${error.code ?? "error"}: ${error.message}`;
}
addEventListener("pagehide", () => client?.dispose(), { once: true });
