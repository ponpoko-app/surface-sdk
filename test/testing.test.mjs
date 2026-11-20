import { test } from "node:test";
import assert from "node:assert/strict";
import { createSurfaceClient } from "../surface.mjs";
import { createMockHost } from "../testing.mjs";

test("a simulated Host drives the real handshake, palette and file-drop listeners", async () => {
  const mock = createMockHost();
  const client = createSurfaceClient({ view: mock.view, transport: mock.transport });
  mock.setPalette({ canvas: "#202020" });
  const palettes = [], drops = [];
  client.onPalette(tokens => palettes.push(tokens));
  client.onDrop(paths => drops.push(paths));
  try {
    assert.equal((await client.ready()).protocol, 1);
    mock.setPalette({ canvas: "#ffffff" });
    mock.drop(["report.txt"]);
    assert.deepEqual(palettes, [{ canvas: "#202020" }, { canvas: "#ffffff" }]);
    assert.deepEqual(drops, [["report.txt"]]);
    assert.deepEqual(mock.requests, []);
  } finally { client.dispose(); }
  mock.setPalette({ canvas: "#111111" });
  assert.equal(palettes.length, 2);
});

test("a simulated Host distinguishes empty results, backend failures and unanswered requests", async () => {
  const mock = createMockHost({
    async onRequest(request) {
      if (request.payload.method === "note.list") return { ok: true, result: [] };
      if (request.payload.method === "note.read") return { ok: false, error: { code: "host_unavailable", message: "Backend offline" } };
    },
  });
  const client = createSurfaceClient({ view: mock.view, transport: mock.transport, timeoutMs: 40 });
  try {
    assert.deepEqual(await client.backend("note.list"), []);
    await assert.rejects(client.backend("note.read"), { code: "host_unavailable", message: "Backend offline" });
    await assert.rejects(client.backend("note.save"), { code: "unknown_outcome", retryable: false });
    assert.deepEqual(mock.requests.map(request => request.payload.method), ["note.list", "note.read", "note.save"]);
  } finally { client.dispose(); }
});
