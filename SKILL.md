---
name: ponpoko-surface-sdk
description: Build or update a standalone Ponpoko surface using its public manifest, broker and Host AI contracts, and run compatibility checks without a private Host checkout. Use for surface authoring and integration, not for editing Ponpoko itself.
---

Use the files beside this skill as the contract source for the selected SDK revision.
Start with [README.md](README.md), [compatibility.json](compatibility.json), and the
[protocol reference](docs/protocol.md). No private repository or sibling checkout
is required. Pin a Git commit or SDK tag rather than relying on moving main.

A surface is a durable bundle with `surface.json`, its entry HTML, and any declared
backend executable. `surfaces` is reserved; `chat` has the same access as any other
surface. See [the standalone example](examples/hello/surface.json).

For browser calls, use `createSurfaceClient` from `surface.mjs`. Keep the URL's
`view` token, validate the real parent handshake, and preserve Host errors. Dispose
the client when the page closes. Cmd/Ctrl+K and Cmd/Ctrl+1–9 belong to the Host;
use Cmd/Ctrl+Alt+1–9 for surface document tabs. Palette tokens come from the Host.

For AI, read `host-ai.d.mts` and `ai-contract.json`. Run
`node scripts/copy-ai-assets.mjs <surface-source>` from this SDK, declare
`requires.ai: 1`, and edit `ai-requests.json` to cover the workflow with safe
examples. Use the injected `window.ponpoko.ai` in the page or `createBackendAi`
from `host-ai.backend.mjs` in a Node/Bun backend. Host owns credentials and the
shared inference runtime. Do not invent provider-specific request fields or add
a second provider runner. SDK updates must keep schema, digest and types together.

Run `npm test` in this repository, then
`node scripts/check-surface.mjs <built-bundle>`. Read the
[compatibility guide](docs/compatibility.md) to distinguish offline validation,
a measured Host handshake, installation, provider setup and paid inference.
An offline pass does not prove the running Host is compatible or that a surface
works. Measure installation and the human's actual workflow separately.

A timed-out mutation has an unknown outcome. Inspect its original request ID or
side effect before sending it again; do not blindly retry. Registration and
capability declarations grant no additional Host access. Keep build dependencies,
credentials, local data and logs out of source publication. This skill does not
authorize publishing repositories or releasing a surface.
