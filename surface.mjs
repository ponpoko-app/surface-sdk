import { BROKER_CHANNEL, PROTOCOL_VERSION, READY_CONTROL, HELLO_CONTROL, PALETTE_CONTROL, DROP_CONTROL, isNamespace, isOperation } from "./protocol.mjs";
import { CONTRACT, createHostAi, uncertainAiOperation } from "./host-ai.mjs";
import { abortable, delay } from "./wait.mjs";

export class HostError extends Error {
  constructor(code, message, { retryable = false, request_id, cursor, snapshot, cloud_request_id, retry } = {}) {
    super(message);
    this.name = "HostError";
    Object.assign(this, { code, retryable, request_id, cursor, snapshot, cloud_request_id, retry });
  }
}

export function checkHost(hello, { ai = false } = {}) {
  if (hello?.protocol !== PROTOCOL_VERSION) throw new HostError("protocol_mismatch", "The running Host uses a different surface protocol.");
  if (ai && (hello.contracts?.ai?.version !== CONTRACT.version || hello.contracts?.ai?.schema_sha256 !== CONTRACT.schema_sha256)) {
    throw new HostError("ai_contract_mismatch", "Use the SDK matching the running Host AI contract.");
  }
  return { protocol: PROTOCOL_VERSION, ai: ai ? CONTRACT : null, paid_requests: 0, inference: "unmeasured" };
}

export function parentTransport(frame = globalThis.window) {
  if (!frame || frame.parent === frame) throw new HostError("host_unavailable", "Open the installed surface inside Ponpoko.");
  return {
    post: value => frame.parent.postMessage(value, "*"),
    subscribe(handler) {
      const listener = event => { if (event.source === frame.parent) handler(event.data); };
      frame.addEventListener("message", listener);
      return () => frame.removeEventListener("message", listener);
    },
  };
}

const READS = new Set([
  "host.platform.protocol.info", "host.platform.preferences.list", "host.platform.providers.list",
  "host.work.list", "host.work.get", "host.work.events.subscribe", "host.work.events.unsubscribe",
]);

export function createSurfaceClient({ view = new URLSearchParams(globalThis.location?.search ?? "").get("view"), transport, timeoutMs = 65000 } = {}) {
  if (typeof view !== "string" || !view.trim()) throw new HostError("stale_view", "The surface URL has no Host view token.");
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 2147483647) throw new HostError("invalid_input", "timeoutMs must fit a positive timer duration.");
  transport ??= parentTransport();
  const pending = new Map();
  const palettes = new Set();
  const drops = new Set();
  const events = new Set();
  const lifetime = new AbortController();
  let hello = null;
  let palette = null;
  let appearance;
  let unsubscribe;
  let waiting = null;

  function finishReady(error) {
    if (!waiting) return;
    clearTimeout(waiting.timer);
    clearInterval(waiting.repeat);
    if (error) waiting.reject(error);
    else waiting.resolve(hello);
    waiting = null;
  }

  function ready() {
    if (lifetime.signal.aborted) return Promise.reject(new HostError("host_unavailable", "This surface client was disposed."));
    if (hello) return Promise.resolve(hello);
    if (waiting) return waiting.promise;
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    function announce() {
      try { transport.post({ channel: BROKER_CHANNEL, view, control: READY_CONTROL }); }
      catch (error) { finishReady(new HostError("host_unavailable", String(error))); }
    }
    const timer = setTimeout(() => finishReady(new HostError("host_unavailable", "The Host did not complete the handshake.", { retryable: true })), Math.min(timeoutMs, 6000));
    waiting = { promise, resolve, reject, timer, repeat: setInterval(announce, 250) };
    try {
      unsubscribe ??= transport.subscribe(receive);
      announce();
    } catch (error) { finishReady(new HostError("host_unavailable", String(error))); }
    return promise;
  }

  function receive(message) {
    if (lifetime.signal.aborted || !message || message.channel !== BROKER_CHANNEL || message.view !== view) return;
    if (message.control === HELLO_CONTROL) {
      try { checkHost(message); hello = message; finishReady(); }
      catch (error) { finishReady(error); }
    } else if (message.control === PALETTE_CONTROL && message.tokens && typeof message.tokens === "object") {
      palette = Object.fromEntries(Object.entries(message.tokens).filter(([, value]) => typeof value === "string"));
      appearance = message.appearance;
      for (const handler of palettes) handler(palette, appearance);
    } else if (message.control === DROP_CONTROL && Array.isArray(message.paths)) {
      const paths = message.paths.filter(path => typeof path === "string" && path);
      for (const handler of drops) handler(paths);
    } else if (typeof message.request_id === "string" && typeof message.ok === "boolean") {
      const held = pending.get(message.request_id);
      if (!held) return;
      held.release();
      if (message.ok) held.resolve(message.result);
      else if (held.ai && message.error?.code === "host_unavailable") held.abandon("host_unavailable", message.error.message || "The Host did not confirm the AI response.");
      else held.reject(new HostError(message.error?.code ?? "host_unavailable", message.error?.message ?? "Host request failed.", { ...message.error, request_id: held.identity }));
    } else if (typeof message.event_id === "string" && Number.isSafeInteger(message.seq) && message.type === "providers-changed") {
      for (const handler of events) handler(message);
    }
  }

  async function call(namespace, operation, payload = {}, { signal } = {}) {
    if (!isNamespace(namespace) || !isOperation(namespace, operation)) throw new HostError("unknown_operation", "This operation is not in the SDK contract.");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new HostError("invalid_input", "Payload must be an object.");
    const cancelled = () => new HostError("aborted", "The request was cancelled.");
    if (signal?.aborted) throw cancelled();
    const host = await abortable(ready(), signal, cancelled);
    if (lifetime.signal.aborted) throw new HostError("host_unavailable", "This surface client was disposed.");
    if (signal?.aborted) throw cancelled();
    const door = `${namespace}.${operation}`;
    if (host.doors && !host.doors.includes(door)) throw new HostError("unknown_operation", `The running Host does not offer ${door}.`);
    const request_id = globalThis.crypto?.randomUUID?.() ?? `sdk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const ai = door === "host.platform.ai.request";
    const identity = ai ? payload.input?.request_id ?? payload.request_id ?? request_id : request_id;
    const uncertain = !(READS.has(door) || (ai && !uncertainAiOperation(payload.operation)));
    return new Promise((resolve, reject) => {
      function release() {
        clearTimeout(timer);
        signal?.removeEventListener("abort", cancel);
        pending.delete(request_id);
      }
      function abandon(code, message) {
        release();
        reject(new HostError(uncertain ? "unknown_outcome" : code, uncertain ? `${message} Inspect the original request before repeating.` : message, {
          request_id: identity,
          retryable: !uncertain && code === "host_unavailable",
        }));
      }
      function cancel() { abandon("aborted", "The SDK stopped waiting for the Host response."); }
      const timer = setTimeout(() => abandon("host_unavailable", "The Host response was not confirmed."), timeoutMs);
      pending.set(request_id, { resolve, reject, release, abandon, identity, ai });
      signal?.addEventListener("abort", cancel, { once: true });
      try { transport.post({ channel: BROKER_CHANNEL, view, request_id, namespace, operation, payload }); }
      catch { abandon("host_unavailable", "The request could not reach the Host."); }
    });
  }

  const checkCompatibility = async options => checkHost(await ready(), options);
  const ai = createHostAi(async (payload, options) => {
    const cancelled = () => new HostError("aborted", "The request was cancelled.");
    if (options?.signal?.aborted) throw cancelled();
    await abortable(checkCompatibility({ ai: payload.operation !== "contract" }), options?.signal, cancelled);
    return call("host.platform", "ai.request", payload, options);
  });

  function followSignal(signal) {
    return signal ? AbortSignal.any([signal, lifetime.signal]) : lifetime.signal;
  }

  async function* workEvents(work_id, { after = 0, signal, intervalMs = 750 } = {}) {
    signal = followSignal(signal);
    while (!signal.aborted) {
      const page = await call("host.work", "events.subscribe", { work_id, after }, { signal });
      after = page.cursor;
      yield page;
      if (page.exhausted) await delay(intervalMs, signal);
    }
  }

  async function* inferenceEvents(requestId, { after = 0, signal, intervalMs = 500 } = {}) {
    signal = followSignal(signal);
    while (!signal.aborted) {
      const receipt = await ai.status(requestId, { signal });
      if (!receipt.found) throw new HostError("not_found", "This surface has no inference receipt with that ID.", { request_id: requestId });
      const page = await ai.events(requestId, after, { signal });
      after = page.cursor;
      for (const event of page.events) yield event;
      if (page.events.length === 128) continue;
      if (receipt.status !== "running") return receipt;
      await delay(intervalMs, signal);
    }
  }

  return Object.freeze({
    ready, call, ai, workEvents, inferenceEvents,
    research: Object.freeze({ search: (input, options) => call("host.platform", "research.search", input, options) }),
    backend: (method, params = {}, options) => call("host.surface", "backend.call", { method, params }, options),
    checkCompatibility,
    onPalette(handler) { palettes.add(handler); if (palette) handler(palette, appearance); return () => palettes.delete(handler); },
    onDrop(handler) { drops.add(handler); return () => drops.delete(handler); },
    onEvent(handler) { events.add(handler); return () => events.delete(handler); },
    dispose() {
      lifetime.abort();
      unsubscribe?.();
      unsubscribe = undefined;
      finishReady(new HostError("host_unavailable", "Surface closed during handshake."));
      for (const held of pending.values()) held.abandon("host_unavailable", "Surface closed before the Host response was confirmed.");
      palettes.clear(); drops.clear(); events.clear(); hello = null;
    },
  });
}
