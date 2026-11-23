import { readFile, stat, realpath, lstat } from "node:fs/promises";
import { dirname, resolve, relative, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";
import { SCHEMA, CONTRACT, validateSchema } from "../host-ai.mjs";
import { checkHost } from "../surface.mjs";
import { checkSecrets } from "./secrets.mjs";

async function json(path) { return JSON.parse(await readFile(path, "utf8")); }

export function checkBundlePath(value, field) {
  if (typeof value !== "string" || !value.trim() || /[\\:\u0000]/.test(value) || value.split("/").some(part => part === ".." || part === "." || !part)) throw new Error(`Invalid relative path: ${field}`);
}

function collectHtmlAssets(html) {
  const refs = [];
  for (const match of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    refs.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/\brel\s*=\s*(?:"[^"]*\bstylesheet\b[^"]*"|'[^']*\bstylesheet\b[^']*'|stylesheet\b)/i.test(tag)) continue;
    const href = tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (href) refs.push(href[1] ?? href[2] ?? href[3] ?? "");
  }
  for (const match of html.matchAll(/<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    refs.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return refs;
}

async function checkEntryAssets(root, entryRel) {
  const entryPath = resolve(root, entryRel);
  const entryDir = dirname(entryPath);
  const html = await readFile(entryPath, "utf8");
  for (const raw of collectHtmlAssets(html)) {
    const trimmed = raw.trim();
    if (!trimmed || /^(?:#|\/\/|https?:|data:|blob:|mailto:|\$\{|{{)/i.test(trimmed)) continue;
    const clean = trimmed.split(/[?#]/, 1)[0].trim();
    if (!clean) continue;
    let resolved;
    try {
      const target = resolve(entryDir, clean);
      resolved = await realpath(target);
    } catch {
      throw new Error(`Missing local asset referenced in ${entryRel}: ${trimmed}`);
    }
    const rel = relative(root, resolved);
    if (rel === ".." || rel.startsWith(`..${sep}`) || !(await stat(resolved)).isFile()) {
      throw new Error(`Entry asset leaves the bundle or is not a regular file: ${trimmed}`);
    }
  }
}

export async function checkSurface(directory, { hostHello } = {}) {
  const root = await realpath(directory);
  const manifest = await json(resolve(root, "surface.json"));
  const keys = ["id", "name", "version", "entry", "description", "contributes", "backend", "methods", "cli", "requires"];
  for (const key of Object.keys(manifest)) if (!keys.includes(key)) throw new Error(`Unknown manifest field: ${key}`);
  if (typeof manifest.id !== "string" || manifest.id.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id) || manifest.id === "surfaces") throw new Error("Invalid or reserved surface id");
  for (const [key, max] of [["name", 64], ["version", 32]]) {
    if (typeof manifest[key] !== "string" || !manifest[key].trim() || [...manifest[key].trim()].length > max) throw new Error(`Invalid manifest ${key}`);
  }
  if (manifest.description !== undefined && (typeof manifest.description !== "string" || [...manifest.description].length > 240)) throw new Error("Invalid manifest description");
  if (!Array.isArray(manifest.contributes) || manifest.contributes.length !== 1 || manifest.contributes[0].slot !== "nav") throw new Error("A surface must contribute exactly one nav entry");
  const entry = manifest.contributes[0];
  if (Object.keys(entry).some(key => !["slot", "title", "icon"].includes(key)) || typeof entry.title !== "string" || !entry.title.trim() || [...entry.title.trim()].length > 64 || !["file-code", "git-branch", "terminal", "palette", "package", "generic"].includes(entry.icon)) throw new Error("Invalid nav contribution");
  const paths = [["entry", manifest.entry]];
  if (typeof manifest.entry !== "string" || !manifest.entry.trim().toLowerCase().endsWith(".html")) throw new Error("entry must name an HTML file");
  for (const field of ["backend", "cli"]) {
    const program = manifest[field];
    if (program !== undefined && program !== null) {
      if (typeof program !== "object" || Object.keys(program).some(key => !["command", "args"].includes(key)) || (program.args !== undefined && (!Array.isArray(program.args) || program.args.some(arg => typeof arg !== "string")))) throw new Error(`Invalid ${field}`);
      paths.push([field, program.command]);
    }
  }
  if (manifest.cli && !manifest.backend) throw new Error("A CLI requires a backend");
  const methods = manifest.methods === undefined ? [] : manifest.methods;
  if (!Array.isArray(methods) || methods.length > 64 || new Set(methods).size !== methods.length || methods.some(method => typeof method !== "string" || method.length > 64 || !/^[a-z0-9][a-z0-9_]*(?:\.[a-z0-9][a-z0-9_]*){1,3}$/.test(method))) throw new Error("Invalid backend methods");
  if (methods.length && !manifest.backend) throw new Error("Declared methods require a backend");
  for (const [field, value] of paths) {
    checkBundlePath(value, field);
    const path = await realpath(resolve(root, value));
    const rel = relative(root, path);
    if (rel === ".." || rel.startsWith(`..${sep}`) || !(await stat(path)).isFile()) throw new Error(`${field} leaves the bundle or is not a regular file`);
  }
  await checkEntryAssets(root, manifest.entry);
  let samples = 0;
  if (manifest.requires !== undefined && manifest.requires !== null) {
    if (typeof manifest.requires !== "object" || Array.isArray(manifest.requires) || Object.keys(manifest.requires).some(key => key !== "ai")) throw new Error("Unknown requires contract");
    if (manifest.requires.ai !== undefined && manifest.requires.ai !== null) {
      if (manifest.requires.ai !== CONTRACT.version) throw new Error("ai_contract_mismatch: unsupported AI version");
      for (const file of ["ai-contract.json", "ai-requests.json"]) {
        const info = await lstat(resolve(root, file));
        if (!info.isFile() || info.isSymbolicLink() || info.size > 262144) throw new Error(`${file} must be a regular file at most 256 KiB`);
      }
      const schema = await json(resolve(root, "ai-contract.json"));
      if (!isDeepStrictEqual(schema, SCHEMA)) throw new Error("ai_contract_mismatch: schema differs from this SDK");
      const requests = await json(resolve(root, "ai-requests.json"));
      if (!Array.isArray(requests) || !requests.length || requests.length > 64) throw new Error("Provide 1 to 64 representative AI requests");
      for (const request of requests) validateSchema(SCHEMA, SCHEMA.$defs.InferenceRequest, request);
      samples = requests.length;
    }
  }
  await checkSecrets(root);
  const compatibility = hostHello ? checkHost(hostHello, { ai: manifest.requires?.ai != null }) : null;
  return { status: "offline_contract_verified", surface_id: manifest.id, samples, sdk_ai_contract: CONTRACT, host: compatibility ?? "unmeasured", host_evidence: compatibility ? "captured_descriptor_only" : "unmeasured", paid_requests: 0, inference: "unmeasured", visual: "unmeasured" };
}

export async function runCheck(args, usage) {
  try {
    if (!args[0] || args.length !== (args[1] === "--host-hello" ? 3 : 1)) throw new Error(usage);
    console.log(JSON.stringify(await checkSurface(args[0], { hostHello: args[2] ? await json(args[2]) : undefined }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

const invoked = process.argv[1] && await realpath(resolve(process.argv[1])).catch(() => null);
if (invoked && import.meta.url === pathToFileURL(invoked).href) {
  await runCheck(process.argv.slice(2), "Usage: node scripts/check-surface.mjs <bundle> [--host-hello <captured-json>]");
}
