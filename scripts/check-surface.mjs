import { constants } from "node:fs";
import { readFile, open, realpath, lstat } from "node:fs/promises";
import { dirname, resolve, relative, sep } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";
import { SCHEMA, CONTRACT, validateSchema } from "../host-ai.mjs";
import { checkHost } from "../surface.mjs";
import { checkSecrets } from "./secrets.mjs";

async function json(path) { return JSON.parse(await readFile(path, "utf8")); }

const windowsDevice = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i;

export function checkBundlePath(value, field) {
  if (typeof value !== "string" || !value.trim() || /[\\:\u0000-\u001f<>|?*"]/.test(value) ||
      value.split("/").some(part => !part || /[. ]$/.test(part) || windowsDevice.test(part))) {
    throw new Error(`Invalid relative path: ${field}`);
  }
}

export async function checkBundleNode(root, value, field, { allowDirectory = false } = {}) {
  checkBundlePath(value, field);
  const parts = value.split("/");
  let path = root;
  for (const [index, part] of parts.entries()) {
    path = resolve(path, part);
    const entry = await lstat(path);
    const leaf = index === parts.length - 1;
    if (entry.isSymbolicLink() ||
        (leaf ? !(entry.isFile() || (allowDirectory && entry.isDirectory())) : !entry.isDirectory())) {
      throw new Error(`${field} leaves the bundle or is not an allowed regular file or directory`);
    }
  }
  return path;
}

export async function readBundleText(root, name, limit) {
  const path = await checkBundleNode(root, name, name);
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const info = await file.stat();
    if (!info.isFile()) throw new Error(`${name} must be a regular file`);
    if (info.size > limit) throw new Error(`${name} exceeds its size limit`);
    const bytes = Buffer.alloc(limit + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await file.read(bytes, length, bytes.length - length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > limit) throw new Error(`${name} exceeds its size limit`);
    return bytes.subarray(0, length).toString("utf8");
  } finally {
    await file.close();
  }
}

async function bundleJson(root, name) {
  const text = await readBundleText(root, name, 256 * 1024);
  try { return JSON.parse(text); }
  catch { throw new Error(`${name} is not valid JSON`); }
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
  const html = await readBundleText(root, entryRel, 2 * 1024 * 1024);
  for (const raw of collectHtmlAssets(html)) {
    const trimmed = raw.trim();
    if (!trimmed || /^(?:#|\/\/|https?:|data:|blob:|mailto:|\$\{|{{)/i.test(trimmed)) continue;
    const clean = trimmed.split(/[?#]/, 1)[0].trim();
    if (!clean) continue;
    const rel = relative(root, resolve(entryDir, clean));
    if (rel === ".." || rel.startsWith(`..${sep}`)) {
      throw new Error(`Entry asset leaves the bundle: ${trimmed}`);
    }
    try { await checkBundleNode(root, rel.split(sep).join("/"), "Entry asset"); }
    catch (error) {
      if (error.code === "ENOENT") throw new Error(`Missing local asset referenced in ${entryRel}: ${trimmed}`);
      throw error;
    }
  }
}

export async function checkSurface(directory, { hostHello } = {}) {
  const root = await realpath(directory);
  const manifest = await bundleJson(root, "surface.json");
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error("surface.json must contain an object");
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
  for (const [field, value] of paths) await checkBundleNode(root, value, field);
  await checkEntryAssets(root, manifest.entry);
  let samples = 0;
  if (manifest.requires !== undefined && manifest.requires !== null) {
    if (typeof manifest.requires !== "object" || Array.isArray(manifest.requires) || Object.keys(manifest.requires).some(key => key !== "ai")) throw new Error("Unknown requires contract");
    if (manifest.requires.ai !== undefined && manifest.requires.ai !== null) {
      if (manifest.requires.ai !== CONTRACT.version) throw new Error("ai_contract_mismatch: unsupported AI version");
      const schema = await bundleJson(root, "ai-contract.json");
      if (!isDeepStrictEqual(schema, SCHEMA)) throw new Error("ai_contract_mismatch: schema differs from this SDK");
      const requests = await bundleJson(root, "ai-requests.json");
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
