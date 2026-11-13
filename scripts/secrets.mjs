import { readFile, readdir, lstat } from "node:fs/promises";
import { resolve } from "node:path";

const policy = JSON.parse(await readFile(new URL("../secret-policy.json", import.meta.url), "utf8"));
const rules = policy.rules.map(rule => ({ ...rule, regex: new RegExp(rule.pattern, rule.insensitive ? "gi" : "g") }));

export function secretFinding(content) {
  for (const rule of rules) {
    rule.regex.lastIndex = 0;
    for (const match of content.matchAll(rule.regex)) {
      if (rule.capture && (policy.placeholders.includes(match[rule.capture]) || match[rule.capture].includes("${"))) continue;
      return rule.id;
    }
  }
  return null;
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
      if (!info.isFile() || ++files > 10000 || info.size > 32 * 1024 * 1024 || (total += info.size) > 256 * 1024 * 1024) throw new Error("credential_guard: bundle cannot be inspected within its limits");
      if (secretFinding(await readFile(path, "utf8"))) throw new Error("credential_guard: likely credential material in a bundled file; values are withheld. Keep credentials outside the bundle in a supported backend runtime setup.");
    }
  }
  await walk(root);
}
