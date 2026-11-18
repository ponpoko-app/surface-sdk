# Ponpoko Surface SDK

The starter and browser runtime for installed Ponpoko surfaces. It uses native
HTML controls, has no JavaScript dependencies and works with Bun's bundler.
The desktop's `surface_create` tool copies an exact, offline SDK tarball and
lockfile into every new source folder. Existing surfaces can keep their builder.

## Build a surface

Edit `index.html`, `main.ts` and `surface.css`. Keep one navigation contribution
in `surface.json`. Run `bun install --frozen-lockfile --ignore-scripts`,
`bun run build` and `bun test`. Install `dist/` in Ponpoko. The build includes
the browser code and CSS and accepts explicit extra assets and Bun backend
entrypoints through `buildSurface({ assets, backends })`.

Once published, an existing project can run
`bun add --exact @zurge-co/ponpoko-surface-sdk@1.1.0`. Use the desktop's pinned tarball
for new surfaces and offline builds. Keep the resolved dependency and lockfile
together. The SDK version describes the source toolchain. Broker protocol 1 and
the declared Host AI contract version and digest govern runtime compatibility.

## Frame and services

```ts
import { createSurfaceClient } from "@zurge-co/ponpoko-surface-sdk";
import { bindSurfaceTheme } from "@zurge-co/ponpoko-surface-sdk/theme";

const host = createSurfaceClient();
const unbind = bindSurfaceTheme(host);
addEventListener("pagehide", () => { unbind(); host.dispose(); }, { once: true });
await host.ready();
const { identity } = await host.call("host.platform", "protocol.info");
```

Call `ready()` after initializing the screen. The parent frame and its view token
identify the surface. TypeScript maps each broker operation to its input and
output. `host.backend<Result>(method, params)` uses the installed surface's
declared backend methods. The platform covers attachments, file save dialogs,
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
surface-backend operation. Host-managed same-origin storage is a separate
transport, available at `/.ponpoko-storage`. The broker client has no storage
wrapper. The starter uses browser storage for the sample note, so that note is
outside the Host-managed SQLite backup and restore path.

Pass `{ signal }` as the last argument to release a pending call. Aborting a
dispatched mutation only stops the local wait. A transport loss or abort after
dispatch can raise `unknown_outcome`; inspect the original ID or side effect
before retrying. Dispose the client to release listeners and outstanding waits.
Cmd/Ctrl+K and Cmd/Ctrl+1–9 are reserved by the desktop.

## UI and appearance

Load `tokens.css` and `components.css` before the surface stylesheet. The starter
build places them at `sdk-tokens.css` and `sdk-components.css` in `dist/`.
The defaults come from the SDK. The Host fills its inherited roles through
`bindSurfaceTheme`, including its scheme and typography. Surface declarations of
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
ink, type and accent in its own stylesheet. To run either, create a fresh source
folder in Ponpoko and overlay the matching folder under `examples/`. Run
`surface_build`, install the returned `dist/` and run the source suite. The
example data belongs to the demonstration.

## Host AI

Declare `requires.ai` from the starter, keep `ai-contract.json`, and edit
`ai-requests.json` with safe representative inputs. The schema and the build's
local validation need no credentials. The Host chooses available connections
from input/output modalities; `ai.slots()` lists configured capabilities.
`ai.validate(request, true)` checks setup without starting inference.

```ts
import type { InferenceRequest } from "@zurge-co/ponpoko-surface-sdk/ai";

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

A backend imports `createBackendAi` from `@zurge-co/ponpoko-surface-sdk/backend`. It uses
the Host's authenticated loopback control endpoint and never receives provider
credentials. Existing browser surfaces can still use the Host-injected
`window.ponpoko.ai`. Catalog release and package API validation belongs to
Ponpoko Cloud.

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
