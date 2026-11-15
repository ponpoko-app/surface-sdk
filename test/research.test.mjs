import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBackendResearch } from "../research.backend.mjs";

test("backend search uses the Host loopback identity and preserves unknown outcome without retries", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ponpoko-research-backend-"));
  const control = join(directory, "control.json");
  const original = globalThis.fetch;
  try {
    await writeFile(control, JSON.stringify({protocol: 1, url: "http://127.0.0.1:12345/", token: "test-control-token"}));
    const calls = [];
    globalThis.fetch = async (url, options) => {
      assert.equal(url.hostname, "127.0.0.1");
      const body = JSON.parse(options.body);
      calls.push(body);
      assert.equal(body.surface_id, "notes");
      assert.equal(body.extra.operation, "research.search");
      assert.equal(options.redirect, "error");
      return Response.json({ok: true, snapshot: {ok: false, error: {code: "search_outcome_unknown", request_id: "cloud-123", message: "Inspect receipt", retry: {retryable: false, guidance: "inspect_request"}}}});
    };
    const client = createBackendResearch({control, surfaceId: "notes"});
    await assert.rejects(client.search({query: "public docs"}), error => error.code === "search_outcome_unknown" && error.cloud_request_id === "cloud-123" && error.retry.retryable === false);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].extra.request_id);
    await writeFile(control, JSON.stringify({protocol: 1, url: "https://example.com/", token: "test-control-token"}));
    await assert.rejects(client.search({query: "public docs"}), {code: "invalid_input"});
    assert.equal(calls.length, 1);
  } finally {globalThis.fetch = original; await rm(directory, {recursive: true, force: true});}
});
