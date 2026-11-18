import { cp, access, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMA, CONTRACT, validateSchema } from "./host-ai.mjs";
import { isDeepStrictEqual } from "node:util";

const sdkRoot = fileURLToPath(new URL(".", import.meta.url));
const required = ["surface.json", "index.html", "surface.css"];

export async function buildSurface({ entry = "main.ts", assets = [], backends = [] } = {}) {
  const manifest = JSON.parse(await readFile("surface.json", "utf8"));
  if (manifest.requires?.ai !== undefined) {
    if (manifest.requires.ai !== CONTRACT.version) throw new Error("ai_contract_mismatch: refresh the Host AI SDK before building.");
    const schema = JSON.parse(await readFile("ai-contract.json", "utf8"));
    if (!isDeepStrictEqual(schema, SCHEMA)) throw new Error("ai_contract_mismatch: ai-contract.json and the pinned SDK disagree.");
    const samples = JSON.parse(await readFile("ai-requests.json", "utf8"));
    if (!Array.isArray(samples) || !samples.length || samples.length > 64) throw new Error("ai-requests.json needs 1 to 64 representative requests.");
    for (const input of samples) validateSchema(SCHEMA, SCHEMA.$defs.InferenceRequest, input, "ai-requests.json");
    assets = [...assets, "ai-contract.json", "ai-requests.json"];
  }

  if (await access(".ponpoko-scaffold.json").then(() => true, () => false)) assets = [...assets, ".ponpoko-scaffold.json"];
  const stage = await mkdtemp(".ponpoko-build-");
  try {
    for (const path of new Set([...required, ...assets])) {
      if (path !== ".ponpoko-scaffold.json" && !/^[a-z0-9_-][a-z0-9_.-]*(?:\/[a-z0-9_-][a-z0-9_.-]*)*$/i.test(path)) throw new Error(`Invalid build asset path: ${path}`);
      await cp(path, join(stage, path), { recursive: true, verbatimSymlinks: true });
    }
    await cp(join(sdkRoot, "ui/tokens.css"), join(stage, "sdk-tokens.css"));
    await cp(join(sdkRoot, "ui/components.css"), join(stage, "sdk-components.css"));
    await cp(join(sdkRoot, "LICENSE"), join(stage, "ponpoko-sdk-license.txt"), { force: false, errorOnExist: true });
    await bundle([entry], stage, "browser", "main.js");
    if (backends.length) await bundle(backends, stage, "bun", "[name].js");
    await rm("dist", { force: true, recursive: true });
    await rename(stage, "dist");
  } finally {
    await rm(stage, { force: true, recursive: true });
  }
}

async function bundle(entrypoints, outdir, target, naming) {
  const result = await Bun.build({ entrypoints, outdir, target, naming });
  if (!result.success) throw new AggregateError(result.logs, "Surface build failed");
}
