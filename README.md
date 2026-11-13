# Ponpoko Surface SDK

Everything needed to author a Ponpoko surface without access to the private Host
repository. This repository is public developer material; it contains no provider
credentials or running Host control tokens. Start an external agent at [SKILL.md](SKILL.md).

Use Node 24 or newer. There are no package dependencies and no automatic CI jobs.

```sh
git clone https://github.com/zurge-co/ponpoko-surface-sdk.git
cd ponpoko-surface-sdk
npm test
node scripts/check-surface.mjs examples/hello
```

Pin a reviewed SDK commit. Read [compatibility.json](compatibility.json) for the
Host source version, protocol and AI schema digest this snapshot was exported
from. `package.json` is private to prevent accidental npm publication; this SDK
is distributed from Git, not advertised as an npm registry package.

The `examples/hello` directory is a complete static source bundle. It connects
to the Host, checks protocol compatibility and displays the negotiated descriptor.
It does not run inference. To try it, install that directory using Ponpoko's
surface installer or `ponpoko surface-install --bundle examples/hello`. The
page reads the SDK files copied inside the example; no private checkout is needed.

For a browser client import `createSurfaceClient` from `surface.mjs`. Its `ready`
method starts the handshake; `backend(method, params)` routes only through the
surface's declared backend. `onPalette` receives Host theme tokens. The
[protocol reference](docs/protocol.md) describes other namespaces and events.

For AI authoring:

```sh
node scripts/copy-ai-assets.mjs /path/to/your/surface
node scripts/check-surface.mjs /path/to/your/built-bundle
```

Declare `requires.ai: 1` in the manifest and replace the starter
`ai-requests.json` with representative requests for your workflow. Existing
request fixtures are preserved. In a page use the injected `window.ponpoko.ai`;
in a Node/Bun backend use `createBackendAi` from `host-ai.backend.mjs`.
Generated files are versioned together. `--replace-contract` explicitly updates
existing generated assets after reviewing a new SDK revision.

Tests and the checker work in a clean clone without Ponpoko, GitHub credentials
or provider access. Their output distinguishes offline checks from an actual
running Host; see [compatibility checks](docs/compatibility.md). Native install,
visual behavior and inference remain unmeasured until tried with a real Host.

The SDK is exported from the Host's canonical schema and broker source with
`node scripts/export-surface-sdk.mjs <checkout>` in the maintainer's Host checkout.
`--check` verifies drift without modifying files. The public tests need only this
repository. Future exports must keep the SDK version and compatibility metadata
reviewable before publication. No scheduled publication is configured here.
