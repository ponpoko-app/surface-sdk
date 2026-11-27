import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdtemp, cp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createSurfaceClient, checkHost, parentTransport, resolveContextBudget, estimateInputTokens, compactInputParts } from "../surface.mjs";
import { SCHEMA, CONTRACT, createHostAi } from "../host-ai.mjs";
import { BROKER_CHANNEL, OPERATIONS } from "../protocol.mjs";
import { checkSurface } from "../scripts/check-surface.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const hello = { channel: BROKER_CHANNEL, view: "frame", control: "ponpoko.host.hello", protocol: 1, contracts: { ai: CONTRACT } };

function wire() {
  const listeners = new Set();
  const sent = [];
  return {
    sent,
    post: value => sent.push(value),
    subscribe(handler) { listeners.add(handler); return () => listeners.delete(handler); },
    deliver(value) { for (const handler of listeners) handler(value); },
  };
}

async function readyClient(timeoutMs = 30) {
  const transport = wire();
  const client = createSurfaceClient({ view: "frame", transport, timeoutMs });
  const ready = client.ready();
  transport.deliver(hello);
  await ready;
  return { client, transport };
}

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), "ponpoko-sdk-"));
  try { await cp(resolve(root, "examples/hello"), directory, { recursive: true }); await run(directory); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test("every public asset has the digest recorded in this SDK snapshot", async () => {
  const snapshot = await readJson(resolve(root, "compatibility.json"));
  for (const [name, expected] of Object.entries(snapshot.assets)) {
    assert.equal(createHash("sha256").update(await readFile(resolve(root, name))).digest("hex"), expected, name);
  }
  assert.deepEqual(snapshot.ai, CONTRACT);
  assert.equal(snapshot.protocol, hello.protocol);
  assert.deepEqual((await readJson(resolve(root, "broker-contract.json"))).operations, OPERATIONS);
  assert.deepEqual(await readJson(resolve(root, "ai-contract.json")), SCHEMA);
});

test("protocol and AI digest mismatches fail without model calls", () => {
  assert.throws(() => checkHost({ ...hello, protocol: 2 }), { code: "protocol_mismatch" });
  assert.throws(() => checkHost({ ...hello, contracts: { ai: { ...CONTRACT, schema_sha256: "changed" } } }, { ai: true }), { code: "ai_contract_mismatch" });
  assert.equal(checkHost(hello, { ai: true }).paid_requests, 0);
});

test("the bundle checker refuses linked and oversized metadata", async () => {
  await fixture(async dir => {
    const manifest = join(dir, "surface.json");
    const copy = join(dir, "manifest-copy.json");
    await writeFile(copy, await readFile(manifest));
    await rm(manifest);
    await symlink(copy, manifest);
    await assert.rejects(checkSurface(dir), /leaves the bundle/);
    await rm(manifest);
    await writeFile(manifest, " ".repeat(256 * 1024 + 1));
    await assert.rejects(checkSurface(dir), /size limit|too large/);
  });
});

test("browser transport rejects a different message source", () => {
  let deliver;
  const parent = { postMessage() {} };
  const frame = { parent, addEventListener(_, listener) { deliver = listener; }, removeEventListener() {} };
  let received = 0;
  const dispose = parentTransport(frame).subscribe(() => received++);
  deliver({ source: {}, data: hello });
  assert.equal(received, 0);
  deliver({ source: parent, data: hello });
  assert.equal(received, 1);
  dispose();
});

test("calls wait for hello and ignore stale views and unrelated request ids", async () => {
  const transport = wire();
  const client = createSurfaceClient({ view: "frame", transport, timeoutMs: 100 });
  const call = client.backend("app.info");
  assert.equal(transport.sent.length, 1);
  transport.deliver({ ...hello, view: "other" });
  assert.equal(transport.sent.length, 1);
  transport.deliver(hello);
  await new Promise(resolve => setTimeout(resolve, 0));
  const request = transport.sent.at(-1);
  assert.equal(request.namespace, "host.surface");
  transport.deliver({ ...request, view: "other", ok: true, result: "wrong" });
  transport.deliver({ ...request, request_id: "other", ok: true, result: "wrong" });
  transport.deliver({ ...request, ok: true, result: "right" });
  assert.equal(await call, "right");
  client.dispose();
});

test("Host scope errors remain typed and unknown operations are rejected locally", async () => {
  const { client, transport } = await readyClient();
  await assert.rejects(client.call("host.platform", "invented"), { code: "unknown_operation" });
  const call = client.backend("app.info");
  await new Promise(resolve => setTimeout(resolve, 0));
  const request = transport.sent.at(-1);
  transport.deliver({ ...request, ok: false, error: { code: "forbidden_scope", message: "outside this frame", retryable: false } });
  await assert.rejects(call, error => error.code === "forbidden_scope" && error.request_id === request.request_id);
  client.dispose();
});

test("mutation timeouts have unknown outcomes and are never retried", async () => {
  const { client, transport } = await readyClient();
  await assert.rejects(client.backend("app.write"), { code: "unknown_outcome" });
  assert.equal(transport.sent.filter(row => row.operation === "backend.call").length, 1);
  await assert.rejects(client.call("host.platform", "protocol.info"), { code: "host_unavailable" });
  client.dispose();
});

test("disposal rejects both an unfinished handshake and a pending mutation", async () => {
  const first = createSurfaceClient({ view: "frame", transport: wire() });
  const ready = first.ready();
  first.dispose();
  await assert.rejects(ready, { code: "host_unavailable" });
  const { client } = await readyClient();
  const call = client.backend("app.write");
  await new Promise(resolve => setTimeout(resolve, 0));
  client.dispose();
  await assert.rejects(call, { code: "unknown_outcome" });
  await assert.rejects(client.ready(), { code: "host_unavailable" });
});

test("malformed inference never reaches the transport", async () => {
  let calls = 0;
  const ai = createHostAi(async () => { calls++; return {}; });
  await assert.rejects(ai.invoke({ ...SCHEMA.examples[0].input, provider_id: "not-a-contract-field" }), { code: "invalid_input" });
  assert.equal(calls, 0);
});

test("the standalone example validates without a Host checkout or credentials", async () => {
  const report = await checkSurface(resolve(root, "examples/hello"));
  assert.equal(report.status, "offline_contract_verified");
  assert.equal(report.host, "unmeasured");
  assert.equal(report.inference, "unmeasured");
  assert.equal(report.paid_requests, 0);
});

test("manifest violations, missing files and escaped entry paths fail preflight", async () => {
  await fixture(async directory => {
    const path = resolve(directory, "surface.json");
    const manifest = await readJson(path);
    for (const patch of [{ id: "surfaces" }, { permissions: ["extra"] }, { methods: ["app.info"] }, { methods: null }, { entry: "../outside.html" }, { entry: "missing.html" }]) {
      await writeFile(path, JSON.stringify({ ...manifest, ...patch }));
      await assert.rejects(checkSurface(directory));
    }
    await writeFile(path, JSON.stringify(manifest));
    await rm(resolve(directory, "index.html"));
    await symlink(resolve(root, "examples/hello/index.html"), resolve(directory, "index.html"));
    await assert.rejects(checkSurface(directory), /leaves the bundle/);
  });
});

test("AI fixtures survive refresh while invalid requests and schema drift fail", async () => {
  await fixture(async directory => {
    const manifest = await readJson(resolve(directory, "surface.json"));
    manifest.requires = { ai: CONTRACT.version };
    await writeFile(resolve(directory, "surface.json"), JSON.stringify(manifest));
    const copy = () => execFileSync(process.execPath, [resolve(root, "scripts/copy-ai-assets.mjs"), directory], { stdio: "pipe" });
    copy();
    const sample = { ...SCHEMA.examples[0].input, request_id: "my-workflow" };
    await writeFile(resolve(directory, "ai-requests.json"), JSON.stringify([sample]));
    copy();
    assert.equal((await readJson(resolve(directory, "ai-requests.json")))[0].request_id, "my-workflow");
    assert.equal((await checkSurface(directory)).samples, 1);
    await writeFile(resolve(directory, "ai-requests.json"), JSON.stringify([{ ...sample, provider_id: "invalid" }]));
    await assert.rejects(checkSurface(directory), /provider_id/);
    await writeFile(resolve(directory, "ai-requests.json"), JSON.stringify([sample]));
    await writeFile(resolve(directory, "ai-contract.json"), JSON.stringify({ ...SCHEMA, contract_version: 99 }));
    await assert.rejects(checkSurface(directory), /ai_contract_mismatch/);
    assert.throws(copy, /differs/);
  });
});

test("invalid timer configuration fails before a transport is created", () => {
  for (const timeoutMs of [0, -1, NaN, Infinity, 2147483648]) {
    assert.throws(() => createSurfaceClient({ view: "frame", transport: wire(), timeoutMs }), { code: "invalid_input" });
  }
});

test("the checker CLI validates and refuses bundles through a symlinked SDK path", async () => {
  await fixture(async directory => {
    const parent = await mkdtemp(join(tmpdir(), "ponpoko-sdk-alias-"));
    try {
      const alias = resolve(parent, "sdk-alias");
      await symlink(root, alias, "dir");
      const command = resolve(alias, "scripts/check-surface.mjs");
      const report = JSON.parse(execFileSync(process.execPath, [command, directory], { encoding: "utf8", stdio: "pipe" }));
      assert.equal(report.status, "offline_contract_verified");
      await writeFile(resolve(directory, "surface.json"), JSON.stringify({ ...(await readJson(resolve(directory, "surface.json"))), entry: "missing.html" }));
      assert.throws(() => execFileSync(process.execPath, [command, directory], { stdio: "pipe" }));
    } finally { await rm(parent, { recursive: true, force: true }); }
  });
});

test("entry HTML local script, stylesheet and image references must exist in the bundle while external/data URLs are skipped", async () => {
  await fixture(async directory => {
    const html = await readFile(resolve(directory, "index.html"), "utf8");
    const safeExternal = html.replace(
      "</head>",
      '<link href="https://example.invalid/style.css" rel="stylesheet"><img src="data:image/png;base64,iVBORw0KGgo="></head>',
    );
    await writeFile(resolve(directory, "index.html"), safeExternal);
    const ok = await checkSurface(directory);
    assert.equal(ok.status, "offline_contract_verified");

    await writeFile(resolve(directory, "index.html"), html.replace("./main.mjs", "./missing.js"));
    await assert.rejects(checkSurface(directory), /missing\.js/i);

    await writeFile(resolve(directory, "index.html"), html.replace("</head>", '<link href="missing.css" rel="stylesheet"></head>'));
    await assert.rejects(checkSurface(directory), /missing\.css/i);

    await writeFile(resolve(directory, "index.html"), html.replace("</head>", '<link rel="stylesheet" href="../outside.css"></head>'));
    await assert.rejects(checkSurface(directory), /outside\.css/i);
  });
});

test("SDK context budget resolves per-phase Cloud and local limits and compacts Thai/long inputs safely", async () => {
  const slots = {
    local: [],
    cloud: [
      { slot_id: "slot_general", io: { inputs: ["image", "text"], outputs: ["text"] }, alias_id: "ponpoko-text-standard", pinned_alias_revision: null, enabled: true, position: 0, status: "active", reason: null, action: null, context_length: 1000000, max_input_bytes: null, max_output_tokens: null },
      { slot_id: "slot_build", io: { inputs: ["image", "text"], outputs: ["text"] }, alias_id: "ponpoko-build", pinned_alias_revision: null, enabled: true, position: 0, status: "active", reason: null, action: null, phase: "build", context_length: 64000, max_input_bytes: null, max_output_tokens: 8192 },
    ],
    managed_by: "administrator",
  };
  const io = { inputs: ["text"], outputs: ["text"] };
  const generalBudget = resolveContextBudget(slots, io);
  assert.equal(generalBudget.source, "cloud");
  assert.equal(generalBudget.max_context_tokens, 1000000);
  const buildBudget = resolveContextBudget(slots, io, { phase: "build" });
  assert.equal(buildBudget.max_context_tokens, 64000);
  assert.ok(buildBudget.trigger_tokens < 64000 && buildBudget.target_tokens < buildBudget.trigger_tokens);

  const localFirst = resolveContextBudget({
    ...slots,
    local: [{ io, provider_id: "ollama", model: "qwen", updated_at: 1, context_length: 32768 }],
  }, io, { phase: "build" });
  assert.equal(localFirst.source, "local");
  assert.equal(localFirst.max_context_tokens, 32768);

  const parts = [
    { type: "text", role: "system", text: "Keep exact Shopee order totals." },
    ...Array.from({ length: 12 }, (_, idx) => ({
      type: "text",
      role: idx % 2 === 0 ? "user" : "assistant",
      text: `รายการ #${idx}: ${"บันทึกรายการ Shopee 🛒 ".repeat(140)}`,
    })),
  ];
  const before = estimateInputTokens(parts);
  assert.ok(before.tokens > 8000);
  const compacted = compactInputParts(parts, { max_context_tokens: 10000, max_output_tokens: 2000 });
  assert.equal(compacted.compacted, true);
  assert.equal(compacted.input[0].role, "system");
  assert.ok(compacted.input.length < parts.length);
  assert.ok(compacted.estimated_tokens < before.tokens);
  assert.ok(compacted.input.some(part => part.text?.includes("Compacted earlier conversation context")));

  const ai = createHostAi(async envelope => {
    assert.equal(envelope.operation, "slots");
    return { ok: true, result: slots };
  });
  const liveBudget = await ai.contextBudget(io, { phase: "build" });
  assert.equal(liveBudget.max_context_tokens, 64000);
  const liveCompact = await ai.compactInput(parts, io, { force: true, keep_recent: 2 });
  assert.equal(liveCompact.compacted, true);
  assert.equal(liveCompact.input[0].role, "system");
});
