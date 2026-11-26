import { test } from "node:test";
import assert from "node:assert/strict";
import { createSurfaceClient, HostError } from "../surface.mjs";
import { CONTRACT, SCHEMA } from "../host-ai.mjs";
import { bindSurfaceTheme } from "../theme.mjs";

const channel = "ponpoko.surface.v1";
const view = "active";
const hello = { control: "ponpoko.host.hello", protocol: 1, contracts: { ai: CONTRACT } };
const sample = SCHEMA.examples[0].input;

function setup(handler = () => {}) {
  let receive;
  const requests = [];
  function deliver(message) { receive?.({ channel, view, ...message }); }
  const client = createSurfaceClient({ view, timeoutMs: 200, transport: {
    subscribe(listener) { receive = listener; return () => { receive = undefined; }; },
    post(message) {
      if (message.control === "ponpoko.surface.ready") { deliver(hello); return; }
      requests.push(message);
      handler(message, result => deliver({ request_id: message.request_id, ok: true, result }));
    },
  } });
  return { client, deliver, requests };
}

test("pre-dispatch abort sends nothing and a dispatched AI mutation retains its receipt ID", async () => {
  const { client, requests } = setup();
  try {
    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(client.ai.invoke(sample, { signal: cancelled.signal }), { code: "aborted" });
    assert.deepEqual(requests, []);
    const controller = new AbortController();
    const waiting = client.ai.invoke(sample, { signal: controller.signal });
    await new Promise(resolve => setTimeout(resolve, 0));
    controller.abort();
    await assert.rejects(waiting, { name: "HostError", code: "unknown_outcome", request_id: sample.request_id, retryable: false });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].payload.input.request_id, sample.request_id);
  } finally { client.dispose(); }
});

test("inference event following drains the cursor and returns the original unknown receipt", async () => {
  const receipt = { found: true, request_id: sample.request_id, status: "unknown_outcome", grant_id: "grant", result: null, inspection_required: true };
  const { client, requests } = setup((request, send) => {
    if (request.payload.operation === "invoke_status") send({ ok: true, result: receipt });
    if (request.payload.operation === "invoke_events") send({ ok: true, result: { cursor: 8, events: [{ seq: 8, event: { type: "delta", output: { type: "text", text: "partial" } } }] } });
  });
  try {
    const stream = client.inferenceEvents(sample.request_id, { after: 7 });
    assert.equal((await stream.next()).value.event.output.text, "partial");
    assert.deepEqual(await stream.next(), { done: true, value: receipt });
    assert.deepEqual(requests.map(row => row.payload.operation), ["invoke_status", "invoke_events"]);
    assert.equal(requests[1].payload.after, 7);
  } finally { client.dispose(); }
});

test("AI setup, media job status and native cancellation use their typed envelopes", async () => {
  const job = { output: [], job: { id: "job-original", status: "queued" } };
  const { client, requests } = setup((request, send) => {
    const operation = request.payload.operation;
    if (operation === "validate") send({ ok: true, result: { valid: true, paid_requests: 0, setup: { status: "setup_required" } } });
    if (operation === "invoke_job_status") send({ ok: true, result: job });
    if (operation === "invoke_job_cancel") send({ ok: true, result: { ...job, job: { ...job.job, status: "cancelled" } } });
  });
  try {
    assert.equal((await client.ai.validate(sample, true)).paid_requests, 0);
    assert.equal((await client.ai.jobStatus(sample.request_id)).job.id, "job-original");
    assert.equal((await client.ai.jobCancel(sample.request_id)).job.status, "cancelled");
    assert.equal(requests[0].payload.check_setup, true);
    assert.deepEqual(requests.slice(1).map(row => row.payload.request_id), [sample.request_id, sample.request_id]);
  } finally { client.dispose(); }
});

test("cursor failures, providers events and drops retain their information and subscriptions detach", async () => {
  const { client, deliver, requests } = setup();
  try {
    await client.ready();
    const drops = [];
    const events = [];
    const off = client.onDrop(paths => drops.push(paths));
    const offEvent = client.onEvent(event => events.push(event.type));
    deliver({ view: "wrong", control: "ponpoko.host.drop", paths: ["ignore"] });
    deliver({ control: "ponpoko.host.drop", paths: ["page.md", 8] });
    deliver({ event_id: "provider:1", seq: 1, type: "providers-changed", payload: {} });
    off();
    offEvent();
    deliver({ control: "ponpoko.host.drop", paths: ["another.md"] });
    deliver({ event_id: "provider:2", seq: 2, type: "providers-changed", payload: {} });
    assert.deepEqual(drops, [["page.md"]]);
    assert.deepEqual(events, ["providers-changed"]);

    const pending = client.workEvents("work", { after: 4 }).next();
    await new Promise(resolve => setTimeout(resolve, 0));
    const snapshot = { durability: { last_event_seq: 25 } };
    deliver({ request_id: requests[0].request_id, ok: false, error: { code: "cursor_expired", cursor: 25, snapshot } });
    await assert.rejects(pending, error => error instanceof HostError && error.cursor === 25 && error.snapshot === snapshot);
  } finally { client.dispose(); }
});

test("a palette update removes stale Host roles and leaves author styles alone", async () => {
  const { client, deliver } = setup();
  const values = new Map([["--pp-accent", "#6f2448"]]);
  const root = { dataset: {}, style: { setProperty: (name, value) => values.set(name, value), removeProperty: name => values.delete(name) } };
  await client.ready();
  const off = bindSurfaceTheme(client, root);
  try {
    deliver({ control: "ponpoko.host.palette", tokens: {}, appearance: {
      theme: "dark", colors: { "--color-base": "#321c18", "--color-accent-gold": "#d8a84e", "--color-accent-lime": "#5aa469", "--color-fg-subtle": "#9d8d84" }, typography: { font: "serif", ui: "15px" },
    } });
    assert.equal(root.dataset.ppHostTheme, "dark");
    assert.equal(values.get("--pp-host-size-ui"), "15px");
    assert.equal(values.get("--pp-host-canvas"), "#321c18");
    assert.equal(values.get("--pp-host-accent-secondary"), "#d8a84e");
    assert.equal(values.get("--pp-host-success"), "#5aa469");
    assert.equal(values.get("--pp-host-subtle"), "#9d8d84");
    deliver({ control: "ponpoko.host.palette", tokens: {}, appearance: {
      theme: "light", colors: { "--color-accent": "#152642", "--color-accent-gold": "#9b7220", "--color-accent-lime": "#2e6b3f", "--color-fg-subtle": "#7a828c" },
    } });
    assert.equal(root.dataset.ppHostTheme, "light");
    assert.equal(values.has("--pp-host-size-ui"), false);
    assert.equal(values.get("--pp-host-accent"), "#152642");
    assert.equal(values.get("--pp-host-accent-secondary"), "#9b7220");
    assert.equal(values.get("--pp-host-success"), "#2e6b3f");
    assert.equal(values.get("--pp-host-subtle"), "#7a828c");
    assert.equal(values.get("--pp-accent"), "#6f2448");
  } finally { off(); client.dispose(); }
  assert.deepEqual([...values], [["--pp-accent", "#6f2448"]]);
});
