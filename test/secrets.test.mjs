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

test("a bundled program above the text scan limit is judged as a program, and text above it is still refused", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ponpoko-program-"));
  try {
    await cp(resolve(root, "examples/hello"), directory, { recursive: true });
    const file = resolve(directory, "backend.bin");
    const bytes = Buffer.alloc(33 * 1024 * 1024, 0x5a);
    bytes.writeUInt8(0, 0);
    await writeFile(file, bytes);
    assert.equal((await checkSurface(directory)).status, "offline_contract_verified");
    bytes.write(`INLINE=ghp_${"Ab9xYc2D".repeat(4)}`, 1, "utf8");
    await writeFile(file, bytes);
    await assert.rejects(checkSurface(directory), error => error.message.includes("credential_guard") && !error.message.includes("Ab9xYc2D"));
    bytes.fill(0x61);
    await writeFile(file, bytes);
    await assert.rejects(checkSurface(directory), error => error.message.includes("32 MiB inspection limit"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
