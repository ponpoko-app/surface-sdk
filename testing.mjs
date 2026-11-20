import { BROKER_CHANNEL, PROTOCOL_VERSION, READY_CONTROL, HELLO_CONTROL, PALETTE_CONTROL, DROP_CONTROL, parseBrokerRequest } from "./protocol.mjs";
import { CONTRACT } from "./host-ai.mjs";

export function createMockHost({ view = "mock-surface", hello = {}, onRequest = () => undefined } = {}) {
  const listeners = new Set();
  const requests = [];
  let palette;

  function deliver(message) {
    const envelope = { ...message, channel: BROKER_CHANNEL, view };
    for (const listener of listeners) listener(envelope);
  }

  async function respond(request) {
    let reply;
    try { reply = await onRequest(request); }
    catch (error) {
      reply = { ok: false, error: { code: "host_unavailable", message: error instanceof Error ? error.message : String(error) } };
    }
    if (reply !== undefined) deliver({ ...reply, request_id: request.request_id });
  }

  return Object.freeze({
    view,
    transport: {
      post(message) {
        if (message?.channel !== BROKER_CHANNEL || message.view !== view) return;
        if (message.control === READY_CONTROL) {
          deliver({ protocol: PROTOCOL_VERSION, contracts: { ai: CONTRACT }, ...hello, control: HELLO_CONTROL });
          if (palette) deliver(palette);
          return;
        }
        const parsed = parseBrokerRequest(message, view);
        if (!parsed.ok) return;
        requests.push(parsed.request);
        void respond(parsed.request);
      },
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    get requests() { return requests.slice(); },
    setPalette(tokens, appearance) {
      palette = { control: PALETTE_CONTROL, tokens, appearance };
      deliver(palette);
    },
    drop(paths) { deliver({ control: DROP_CONTROL, paths }); },
  });
}
