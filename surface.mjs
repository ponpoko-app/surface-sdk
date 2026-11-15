import { BROKER_CHANNEL, PROTOCOL_VERSION, READY_CONTROL, HELLO_CONTROL, PALETTE_CONTROL, isNamespace, isOperation } from "./protocol.mjs";
import { CONTRACT } from "./host-ai.mjs";

function failure(code, message, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

export function checkHost(hello, { ai = false } = {}) {
  if (hello?.protocol !== PROTOCOL_VERSION) throw failure("protocol_mismatch", "The running Host uses a different surface protocol.");
  if (ai && (hello.contracts?.ai?.version !== CONTRACT.version || hello.contracts?.ai?.schema_sha256 !== CONTRACT.schema_sha256)) {
    throw failure("ai_contract_mismatch", "Use the SDK matching the running Host AI contract.");
  }
  return { protocol: PROTOCOL_VERSION, ai: ai ? CONTRACT : null, paid_requests: 0, inference: "unmeasured" };
}

export function parentTransport(frame = globalThis.window) {
  if (!frame || frame.parent === frame) throw failure("host_unavailable", "Open the installed surface inside Ponpoko.");
  return {
    post: value => frame.parent.postMessage(value, "*"),
    subscribe(handler) {
      const listener = event => { if (event.source === frame.parent) handler(event.data); };
      frame.addEventListener("message", listener);
      return () => frame.removeEventListener("message", listener);
    },
  };
}

const READS = new Set(["host.platform.protocol.info", "host.platform.preferences.list", "host.platform.providers.list", "host.work.list", "host.work.get", "host.work.events.subscribe", "host.work.events.unsubscribe"]);

export function createSurfaceClient({ view = new URLSearchParams(globalThis.location?.search ?? "").get("view"), transport, timeoutMs = 65000 } = {}) {
  if (typeof view !== "string" || !view.trim()) throw failure("stale_view", "The surface URL has no Host view token.");
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 2147483647) throw failure("invalid_input", "timeoutMs must fit a positive timer duration.");
  transport ??= parentTransport();
  const pending = new Map();
  const palettes = new Set();
  const events = new Set();
  let hello = null;
  let palette = null;
  let stopped = false;
  let unsubscribe;
  let waiting = null;

  function ready() {
    if (stopped) return Promise.reject(failure("host_unavailable", "This surface client was disposed."));
    if (hello) return Promise.resolve(hello);
    if (waiting) return waiting.promise;
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    const timer = setTimeout(() => {
      waiting = null;
      reject(failure("host_unavailable", "The Host did not complete the handshake."));
    }, Math.min(timeoutMs, 6000));
    waiting = { promise, resolve, reject, timer };
    try {
      unsubscribe ??= transport.subscribe(receive);
      transport.post({ channel: BROKER_CHANNEL, view, control: READY_CONTROL });
    } catch (error) {
      clearTimeout(timer);
      waiting = null;
      reject(error);
    }
    return promise;
  }

  function receive(message) {
    if (stopped || !message || message.channel !== BROKER_CHANNEL || message.view !== view) return;
    if (message.control === HELLO_CONTROL) {
      try {
        checkHost(message);
        hello = message;
        if (waiting) { clearTimeout(waiting.timer); waiting.resolve(message); waiting = null; }
      } catch (error) {
        if (waiting) { clearTimeout(waiting.timer); waiting.reject(error); waiting = null; }
      }
    } else if (message.control === PALETTE_CONTROL && message.tokens && typeof message.tokens === "object") {
      palette = Object.fromEntries(Object.entries(message.tokens).filter(([, value]) => typeof value === "string"));
      for (const handler of palettes) handler(palette);
    } else if (typeof message.request_id === "string" && typeof message.ok === "boolean") {
      const held = pending.get(message.request_id);
      if (!held) return;
      clearTimeout(held.timer);
      pending.delete(message.request_id);
      if (message.ok) held.resolve(message.result);
      else held.reject(failure(message.error?.code ?? "host_unavailable", message.error?.message ?? "Host request failed", { ...message.error, request_id: message.request_id }));
    } else if (typeof message.event_id === "string" && Number.isSafeInteger(message.seq)) {
      for (const handler of events) handler(message);
    }
  }

  async function call(namespace, operation, payload = {}) {
    if (!isNamespace(namespace) || !isOperation(namespace, operation)) throw failure("unknown_operation", "This operation is not in the SDK contract.");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw failure("invalid_input", "Payload must be an object.");
    await ready();
    if (stopped) throw failure("host_unavailable", "This surface client was disposed.");
    const request_id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const uncertain = !READS.has(`${namespace}.${operation}`);
      const timer = setTimeout(() => {
        pending.delete(request_id);
        reject(failure(uncertain ? "unknown_outcome" : "host_unavailable", "The Host response was not confirmed. Inspect the outcome before repeating a mutation.", { request_id }));
      }, timeoutMs);
      pending.set(request_id, { resolve, reject, timer, uncertain });
      try { transport.post({ channel: BROKER_CHANNEL, view, request_id, namespace, operation, payload }); }
      catch (error) {
        clearTimeout(timer); pending.delete(request_id);
        reject(failure(uncertain ? "unknown_outcome" : "host_unavailable", error.message, { request_id }));
      }
    });
  }

  return Object.freeze({
    ready, call,
    research: Object.freeze({ search: async input => {
      const hello = await ready();
      if (!hello.doors?.includes("host.platform.research.search")) throw failure("unknown_operation", "The running Host does not offer web search.");
      return call("host.platform", "research.search", input);
    } }),
    backend: (method, params = {}) => call("host.surface", "backend.call", { method, params }),
    checkCompatibility: async options => checkHost(await ready(), options),
    onPalette(handler) { palettes.add(handler); if (palette) handler(palette); return () => palettes.delete(handler); },
    onEvent(handler) { events.add(handler); return () => events.delete(handler); },
    dispose() {
      stopped = true; unsubscribe?.();
      if (waiting) { clearTimeout(waiting.timer); waiting.reject(failure("host_unavailable", "Surface closed during handshake.")); waiting = null; }
      for (const [id, held] of pending) {
        clearTimeout(held.timer);
        held.reject(failure(held.uncertain ? "unknown_outcome" : "host_unavailable", "Surface closed before the Host response was confirmed.", { request_id: id }));
      }
      pending.clear(); palettes.clear(); events.clear(); hello = null;
    },
  });
}
