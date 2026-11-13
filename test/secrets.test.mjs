import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkSurface } from "../scripts/check-surface.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

test("new surfaces without Git cannot pass with credentials in ordinary source or config", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ponpoko-credential-"));
  try {
    await cp(resolve(root, "examples/hello"), directory, { recursive: true });
    for (const filename of ["main.mjs", "config.json", "README.md"]) {
      const file = resolve(directory, filename);
      await writeFile(file, 'const config = { partner_key: "opaque-secret-value" };');
      await assert.rejects(checkSurface(directory), error => error.message.includes("credential_guard") && !error.message.includes("opaque-secret-value"));
      await writeFile(file, 'const partnerKey = process.env.SHOPEE_PARTNER_KEY;');
    }
    assert.equal((await checkSurface(directory)).status, "offline_contract_verified");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
