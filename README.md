# Ponpoko Surface SDK

The starter and browser runtime for installed Ponpoko surfaces. It uses native
HTML controls, has no JavaScript dependencies and works with Bun's bundler.
The desktop's `surface_create` tool copies an exact, offline SDK tarball and
lockfile into every new source folder. Existing surfaces can keep their builder.

## Build a surface

Edit `index.html` and `main.ts` for your workflow. Keep one navigation contribution
in `surface.json`. Run `bun install --frozen-lockfile --ignore-scripts` and
`bun run build`. Add a test script for your workflow. Install `dist/` in Ponpoko.
The build includes the browser code and an optional `surface.css`, and accepts explicit extra assets and Bun backend
entrypoints through `buildSurface({ assets, backends })`. Run
`npx ponpoko-surface check dist` for an offline check of the manifest, bundle
files, credential guard and declared AI contract. Installation, inference and
visual behavior need separate evidence.

For a compiled program, declare its path under `backend.command` or
`cli.command` in `surface.json`. Pass the compiler output to the builder.

```js
await buildSurface({ executables: { backend: "target/release/notes-backend" } });
```

The surface owns compilation. The builder copies each program to the declared
path, makes it executable on Unix, and carries an input `.exe` suffix into the
staged manifest. It validates the full staged bundle before replacing `dist/`.

Once published, an existing project can run
`bun add --exact @ponpoko-app/surface-sdk@1.3.0`. Use the desktop's pinned tarball
for new surfaces and offline builds. Keep the resolved dependency and lockfile
together. The SDK version describes the source toolchain. Broker protocol 1 and
the declared Host AI contract version and digest govern runtime compatibility.

To upgrade a source project from `@zurge-co/ponpoko-surface-sdk`, replace the
dependency and its import prefixes with `@ponpoko-app/surface-sdk`, then update
the project's lockfile. Existing installed bundles already contain their built
SDK code.

## Frame and services

```ts
import { createSurfaceClient } from "@ponpoko-app/surface-sdk";
import { bindSurfaceTheme } from "@ponpoko-app/surface-sdk/theme";

const host = createSurfaceClient();
const unbind = bindSurfaceTheme(host);
addEventListener("pagehide", () => { unbind(); host.dispose(); }, { once: true });
await host.ready();
const { identity } = await host.call("host.platform", "protocol.info");
```

Call `ready()` after initializing the screen. The parent frame and its view token
identify the surface. TypeScript maps each broker operation to its input and
output. `host.backend<Result>(method, params)` uses the installed surface's
declared backend methods. For typed method names and arguments, share a method
map between the client and TypeScript backend handlers:

```ts
import { createSurfaceClient, type BackendHandlers } from "@ponpoko-app/surface-sdk";

interface NotesMethods {
  "note.list": [undefined, string[]];
  "note.read": [{ id: string }, { body: string } | null];
}

const handlers: BackendHandlers<NotesMethods> = {
  "note.list": () => ["welcome"],
  "note.read": ({ id }) => id === "welcome" ? { body: "Hello" } : null,
};
const host = createSurfaceClient<NotesMethods>();
await host.backend("note.list");
await host.backend("note.read", { id: "welcome" });
```

The method map is a TypeScript contract. Declare the matching names in
`surface.json` and validate untrusted input in the backend. The platform covers
attachments, file save dialogs,
preferences, provider summaries, settings, external links, research and AI.
The surface namespace covers a file dialog, clipboard reading and backend calls.
The work namespace covers listing, reading, cursor pages, appending instructions,
pausing, resuming with a budget and stopping.

`onPalette`, `onDrop` and `onEvent` return unsubscribe functions. The Host
currently pushes `providers-changed`; work events are cursor pages, so
`host.workEvents(id, { signal })` follows them by polling. A stale cursor raises
`HostError` with `code: "cursor_expired"`, a fresh cursor and a snapshot.
Explicitly restart from that cursor after replacing the local snapshot.
The broker's unsubscribe operation is an acknowledgement. Aborting the SDK
iterator ends its polling.

The file-save operations return a selected path. File writes are a
surface-backend operation.

Pass `{ signal }` as the last argument to release a pending call. Aborting a
dispatched mutation only stops the local wait. A transport loss or abort after
dispatch can raise `unknown_outcome`; inspect the original ID or side effect
before retrying. Dispose the client to release listeners and outstanding waits.
Cmd/Ctrl+K and Cmd/Ctrl+1–9 are reserved by the desktop.

## Save small values in the Host

```ts
import { createSurfaceStorage } from "@ponpoko-app/surface-sdk/storage";

const storage = createSurfaceStorage(host);
const draft = (await storage.get("draft")) ?? "";
await storage.set("draft", draft);
```

The client routes requests through the registered surface's broker to Host
storage and its backup path. Use a desktop Host that advertises the storage
operations. A standalone preview can use a client backed by `createMockHost`.
`get` returns `null` for an absent key. `set` and `remove` resolve after the Host
confirms. Keep the draft visible on failure. For `HostError` with
`code: "unknown_outcome"`, read the stored value before retrying a write.
The Host limits each value to 1 MiB and the entire store to 5 MiB.

## Test with a simulated Host

Import `createMockHost` from `@ponpoko-app/surface-sdk/testing`. It supplies
a `view` and `transport` for the real client. It performs the handshake and
records requests so tests can assert what was sent.

```js
const mock = createMockHost({
  onRequest: request => request.payload?.method === "note.list" ? { ok: true, result: [] } : undefined,
});
const host = createSurfaceClient({ view: mock.view, transport: mock.transport, timeoutMs: 50 });
try {
  await host.ready();
  const notes = await host.backend("note.list");
} finally {
  host.dispose();
}
```

Use `mock.setPalette(tokens, appearance)` or `mock.drop(paths)` to deliver Host
events. Return `{ ok: false, error: { code: "host_unavailable", message: "Offline" } }`
for a backend error, or `undefined` to leave a request unanswered for a timeout
test. A successful empty result, such as `[]`, is a separate case. Tests using
this transport run without a native window or provider requests.

## UI and appearance

New starters use `buildSurface({ styles: [] })` and begin with native HTML.
Use your own stylesheet with the live `--pp-host-*` values from `bindSurfaceTheme`,
or opt into the SDK styles. `styles: ["tokens"]` copies `sdk-tokens.css`. Add
`"components"` to copy `sdk-components.css`. Link the chosen files before your
stylesheet in HTML. The components sheet includes page-wide defaults. Calls that
omit `styles` continue to copy both files for existing builders.

The Host fills inherited roles through `bindSurfaceTheme`, including its scheme
and typography. With the token sheet, surface declarations of
`--pp-*` in `surface.css` take precedence and can be scoped to a subtree. Delete
a declaration to inherit the live Host value again. Leave `--pp-host-*` to the
binding. For a surface that intentionally fixes light or dark, set `--pp-scheme`.

| Area | Semantic roles |
| --- | --- |
| Background and content | `canvas`, `panel`, `surface`, `raised`, `text`, `muted` |
| Interaction | `accent`, `on-accent`, `focus`, `hover`, `selection`, `danger`, `attention` |
| Typography | `font`, `font-heading`, `font-mono`, `size-body`, `size-ui`, `size-code`, `size-title`, `heading-weight`, `leading` |
| Geometry and depth | `space-1` through `space-6`, `radius`, `border`, `border-strong`, `border-width`, `shadow` |
| Density and motion | `control-height`, `control-inset`, `row-inset`, `motion` |

Prefix each role with `--pp-`. When changing the accent, set the matching
`on-accent` and `focus` and check contrast. The shared toolbar, button, field,
panel, table and status styles use native elements. Pair fields with labels and
connect validation using `setFieldError`. Use a `role="status"` region with
`setStatus`, and `setButtonBusy` while an action is running. Keep drafts after a
failed save. A disabled or busy state should not be the only feedback.

See the source examples in the SDK repository. **Dispatch queue** inherits
Host colors with compact controls, and **Field notebook** overrides the canvas,
ink, type and accent in its own stylesheet. To run either, create fresh source
in Ponpoko and overlay the matching folder under `examples/`. Set
`styles: ["tokens", "components"]` in `build.mjs` and add a `test` script
using `bun test`. For Dispatch, enable Host AI with text input and output.
Run `surface_build`, install `dist/` and run the suite with demonstration data.

## Host AI

Pass `ai_io` to `surface_create` to declare `requires.ai` and seed editable
fixtures. To add AI to an existing surface, declare the running Host's AI
contract version, copy `@host/ai-contract.json` into source and create
`ai-requests.json` with safe representative inputs. The schema and the build's
local validation need no credentials. The Host chooses available connections
from input/output modalities; `ai.slots()` lists configured capabilities.
`ai.validate(request, true)` checks setup without starting inference.

```ts
import type { InferenceRequest } from "@ponpoko-app/surface-sdk/ai";

const request: InferenceRequest = {
  request_id: crypto.randomUUID(),
  io: { inputs: ["text"], outputs: ["text"] },
  input: [{ type: "text", text: "Summarize this observation." }],
  stream: true,
  budget: { seconds: 30, output_bytes: 4096 },
};
const ready = await host.ai.validate(request, true);
if (ready.setup?.status === "ready") {
  const receipt = await host.ai.invoke(request);
  for await (const { event } of host.inferenceEvents(receipt.request_id)) {
    if (event.type === "delta") renderDelta(event.output.text ?? "");
  }
  const finalReceipt = await host.ai.status(receipt.request_id);
  renderReceipt(finalReceipt);
}
```

The render functions in this example belong to the surface. Call invoke only for
an explicit action with the requested budget. Retain its request ID before
sending. Use `lookup(id)` or `status(id)` for the original receipt and grant,
`events(id, after)` for cursor pages and `usage()` for recorded usage. A receipt
can be `unknown_outcome` with `inspection_required`. A repeated ID with different
input conflicts. Polling accepts an AbortSignal. `stop(id)` requests native
cancellation. Use `jobStatus(id)` and `jobCancel(id)` for an invocation that
returned a media job. Adapter capabilities and returned jobs depend on the
running Host and configured slots.

A backend imports `createBackendAi` from `@ponpoko-app/surface-sdk/backend`. It uses
the Host's authenticated loopback control endpoint and never receives provider
credentials. Existing browser surfaces can still use the Host-injected
`window.ponpoko.ai`. Catalog release and package API validation belongs to
Ponpoko Cloud.

### Context limits & compaction

Each configured Cloud or local model carries its own `context_length` (exposed on
`host.ai.slots()`). When a surface calls `host.ai.invoke()` for text/chat
workflows, the Host automatically compacts older conversation parts whenever the
input approaches the active model's context ceiling (75% of safe input capacity)
and retries with tighter compaction if the upstream still rejects with
`context_length_exceeded` or `payload_too_large`.

Surfaces that manage their own threads or want to preview/control compaction
directly can call the SDK helpers from `@ponpoko-app/surface-sdk`,
`@ponpoko-app/surface-sdk/ai`, or `@ponpoko-app/surface-sdk/backend`:

```ts
import {
  estimateInputTokens,
  compactInputParts,
  resolveContextBudget,
} from "@ponpoko-app/surface-sdk";

const io = { inputs: ["text"], outputs: ["text"] };
const budget = await host.ai.contextBudget(io);
const est = estimateInputTokens(parts);
const prepared =
  budget.trigger_tokens && est.tokens >= budget.trigger_tokens
    ? compactInputParts(parts, budget, { keep_recent: 4 })
    : { input: parts, compacted: false };
```

`host.ai.compactInput(parts, io, options)` combines `contextBudget(io)` and
`compactInputParts(...)` in one call. System parts, initial user intent and
recent turns are preserved; Thai and other multi-byte scripts are estimated and
trimmed safely on character boundaries.

## License

The SDK code and documentation shipped in the npm package, including the
starter, use the MIT License. The SDK builder puts its notice at
`dist/ponpoko-sdk-license.txt` for distribution alongside the bundled SDK.
Keep that notice when distributing the bundle. Surface authors can choose
terms for their own code.

## Maintainers

The Host repository generates the protocol and AI assets and exports the SDK
checkout. Its `scripts/build-surface-starter.mjs` packs the exact npm artifact
and locks it for offline creation. Run the SDK compatibility tests with
`npm test` in the SDK checkout.
