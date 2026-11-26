import assert from "node:assert/strict";
import { test } from "node:test";
import { createSurfaceClient } from "../surface.mjs";
import { createSurfaceStorage } from "../storage.mjs";
import { createMockHost } from "../testing.mjs";

test("storage deals in strings and waits for the Host to confirm writes", async () => {
  const records = new Map();
  const mock = createMockHost({ onRequest: ({ operation, payload: { key, value } }) => {
    if (operation === "storage.get") return { ok: true, result: records.get(key) ?? null };
    if (operation === "storage.set") records.set(key, value);
    else if (operation === "storage.remove") records.delete(key);
    else assert.fail(`Unexpected operation: ${operation}`);
    return { ok: true, result: true };
  } });
  const host = createSurfaceClient({ view: mock.view, transport: mock.transport });
  const storage = createSurfaceStorage(host);
  try {
    assert.equal(await storage.get("draft"), null);
    await storage.set("draft", "ตัวอย่าง");
    assert.equal(await storage.get("draft"), "ตัวอย่าง");
    await storage.remove("draft");
    assert.equal(await storage.get("draft"), null);
  } finally { host.dispose(); }
});

test("lost storage acknowledgements distinguish reads, writes and explicit rejections", async () => {
  const mock = createMockHost({ onRequest: ({ payload }) =>
    payload.key === "full" ? { ok: false, error: { code: "quota_exhausted", message: "Storage is full." } } : undefined,
  });
  const host = createSurfaceClient({ view: mock.view, transport: mock.transport, timeoutMs: 40 });
  const storage = createSurfaceStorage(host);
  try {
    await assert.rejects(storage.set("full", "keep my draft"), { code: "quota_exhausted" });
    await assert.rejects(storage.get("draft"), { code: "host_unavailable" });
    await assert.rejects(storage.set("draft", "keep my draft"), { code: "unknown_outcome" });
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(storage.remove("draft", { signal: controller.signal }), { code: "aborted" });
    assert.deepEqual(mock.requests.map(row => row.operation), ["storage.set", "storage.get", "storage.set"]);
  } finally { host.dispose(); }
});

test("getJson and setJson handle fallbacks, Thai text, invalid JSON, non-serializable values, and aborts", async () => {
  const records = new Map();
  const mock = createMockHost({ onRequest: ({ operation, payload: { key, value } }) => {
    if (operation === "storage.get") return { ok: true, result: records.get(key) ?? null };
    if (operation === "storage.set") records.set(key, value);
    else assert.fail(`Unexpected operation: ${operation}`);
    return { ok: true, result: true };
  } });
  const host = createSurfaceClient({ view: mock.view, transport: mock.transport });
  const storage = createSurfaceStorage(host);
  try {
    assert.equal(await storage.getJson("missing"), null);
    assert.deepEqual(await storage.getJson("todos", []), []);
    const sample = [{ id: "1", title: "ซื้อกับข้าว" }];
    await storage.setJson("todos", sample);
    assert.deepEqual(await storage.getJson("todos", []), sample);
    records.set("broken", "{not-json");
    await assert.rejects(storage.getJson("broken", []), SyntaxError);
    await assert.rejects(storage.setJson("bad", undefined), TypeError);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(storage.getJson("todos", [], { signal: controller.signal }), { code: "aborted" });
    await assert.rejects(storage.setJson("todos", sample, { signal: controller.signal }), { code: "aborted" });
  } finally { host.dispose(); }
});
