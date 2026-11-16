import { readFile, readdir, lstat } from "node:fs/promises";
import { resolve } from "node:path";
import { isUtf8 } from "node:buffer";

const policy = JSON.parse(await readFile(new URL("../secret-policy.json", import.meta.url), "utf8"));
const rules = policy.rules.map(rule => ({ ...rule, regex: new RegExp(rule.pattern, rule.insensitive ? "gi" : "g") }));

export const TEXT_INSPECTION_LIMIT = 32 * 1024 * 1024;
export const PROGRAM_INSPECTION_LIMIT = 8 * 1024 * 1024;

const WINDOW = 64 * 1024;
const OVERLAP = 1024;

function finding(content, programsOnly) {
  for (const rule of rules) {
    if (programsOnly && !rule.binary) continue;
    if (rule.binary && !rule.binary.some(anchor => content.includes(anchor))) continue;
    rule.regex.lastIndex = 0;
    for (const match of content.matchAll(rule.regex)) {
      if (rule.capture && (policy.placeholders.includes(match[rule.capture]) || match[rule.capture].includes("${"))) continue;
      return rule.id;
    }
  }
  return null;
}

function scan(content, programsOnly) {
  for (let start = 0; start < content.length; start += WINDOW) {
    const found = finding(content.slice(start, start + WINDOW + OVERLAP), programsOnly);
    if (found) return found;
  }
  return null;
}

export function secretFinding(content) {
  return scan(content, false);
}

export function programFinding(content) {
  return scan(content, true);
}

function readableText(buffer) {
  return !buffer.includes(0) && isUtf8(buffer);
}

export async function checkSecrets(root) {
  let files = 0;
  let total = 0;
  async function walk(directory) {
    for (const name of await readdir(directory)) {
      if (name.toLowerCase().startsWith(".env") || /^(?:credentials\.json|\.npmrc|\.netrc|secrets|llm-credentials|id_rsa.*|id_ed25519.*)$/i.test(name) || /\.(pem|key|p12|pfx|keystore|secret|token)$/i.test(name)) throw new Error("credential_guard: credential files must stay outside the surface bundle");
      const path = resolve(directory, name);
      const info = await lstat(path);
      if (info.isSymbolicLink()) throw new Error("credential_guard: a bundle must not contain symlinks");
      if (info.isDirectory()) { await walk(path); continue; }
      if (!info.isFile() || ++files > 10000 || (total += info.size) > 256 * 1024 * 1024) throw new Error("credential_guard: bundle cannot be inspected within its limits");
      const buffer = await readFile(path);
      if (buffer.length > TEXT_INSPECTION_LIMIT) {
        if (readableText(buffer)) throw new Error("credential_guard: a text file in this bundle is larger than the 32 MiB inspection limit, so it cannot be read whole; keep large data files outside the bundle");
        if (programFinding(buffer.subarray(0, PROGRAM_INSPECTION_LIMIT).toString("latin1"))) throw new Error("credential_guard: likely credential material inside a bundled program; values are withheld. Keep credentials outside the bundle.");
        continue;
      }
      if (secretFinding(buffer.toString("utf8"))) throw new Error("credential_guard: likely credential material in a bundled file; values are withheld. Keep credentials outside the bundle in a supported backend runtime setup.");
    }
  }
  await walk(root);
}
