import { readFile, writeFile, mkdir, lstat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMA } from "../host-ai.mjs";

const sdk = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
if (!args[0] || args.length > 2 || (args[1] && args[1] !== "--replace-contract")) throw new Error("Usage: node scripts/copy-ai-assets.mjs <surface-source> [--replace-contract]");
const root = resolve(args[0]);
const files = ["ai-contract.json", "host-ai.mjs", "host-ai.d.ts", "host-ai.d.mts", "host-ai.backend.mjs", "host-ai.backend.d.mts"];
const writes = [];
for (const file of files) {
  const destination = resolve(root, file);
  const info = await lstat(destination).catch(error => { if (error.code !== "ENOENT") throw error; return null; });
  if (info && (!info.isFile() || info.isSymbolicLink())) throw new Error(`Refusing non-regular file: ${file}`);
  const body = await readFile(resolve(sdk, file), "utf8");
  if (info && await readFile(destination, "utf8") !== body && args[1] !== "--replace-contract") throw new Error(`${file} differs; review the SDK version and use --replace-contract to update generated assets`);
  writes.push([destination, body]);
}
await mkdir(root, { recursive: true });
for (const [path, body] of writes) await writeFile(path, body);
try { await writeFile(resolve(root, "ai-requests.json"), `${JSON.stringify([SCHEMA.examples[0].input], null, 2)}\n`, { flag: "wx" }); }
catch (error) { if (error.code !== "EEXIST") throw error; }
console.log("AI assets copied; existing request fixtures were preserved. Declare requires.ai and replace the starter request with your workflow's safe examples.");
