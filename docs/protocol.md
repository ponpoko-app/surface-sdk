# Host protocol 1

The machine-readable operation list is [broker-contract.json](../broker-contract.json).
Wire types and validation helpers are in [protocol.ts](../protocol.ts). The Host
is the authority for payload scope, identity, budgets and registration. A surface
id, repository owner or registration never grants privileged access.

The Host loads `surface.json.entry` in a registered frame with a URL `view` token.
The page sends `{channel:"ponpoko.surface.v1",view,control:"ponpoko.surface.ready"}`
to its parent. Listen only to the actual parent and require matching channel and
view on replies. Host answers `ponpoko.host.hello` with `protocol`, `doors` and
`contracts.ai` (`version`, `schema_sha256`). The SDK performs these checks.

Requests contain `channel`, `view`, unique `request_id`, `namespace`, `operation`
and an object `payload`. Responses echo channel/view/request_id, carry `ok` and
`result` or `{error:{code,message,retryable}}`. Events carry `event_id`, integer
`seq`, `type`, `timestamp` and optional work/thread ids and payload. A stale view
must not consume another frame's response. There is no automatic mutation retry.

| Namespace | Typical payload |
| --- | --- |
| `host.surface / backend.call` | `{method:"app.info",params:{}}`; the method must appear in `surface.json.methods` and a backend must be declared |
| `host.surface / tool.file` | `{mode:"open",directory:true}` for a folder chooser; see the Host's response before using its path |
| `host.surface / tool.paste` | `{}`; returns clipboard content through the registered frame |
| `host.platform / protocol.info` | `{}`; returns protocol, Host version, identity and AI contract descriptor |
| `host.platform / research.search` | `{query, domains?: string[]}`; returns Cloud search contract v1, consumes shared points, never automatically replay on timeout |
| `host.platform / ai.request` | A validated AI envelope; prefer the generated AI SDK |
| `host.platform / link.open` | `{href:"https://example.com"}` |
| `host.platform / settings.open` | `{destination:"connections"}` only when that destination is supported by the running Host |
| `host.work / list` | `{workspace_id?:"..."}` |
| `host.work / get` | `{work_id:"..."}` |
| `host.work / events.subscribe` | `{work_id:"...",after:0,limit:200}`; read cursor expiration errors instead of guessing missing events |
| `host.work / pause, stop` | `{work_id:"..."}` |
| `host.work / instruction.append` | `{work_id:"...",text:"..."}` |
| `host.work / resume` | `{work_id:"...",rounds:32,seconds:1200,output_bytes:524288}`; this grants an invocation budget rather than resetting usage |

`ponpoko.host.palette` carries string-valued `tokens`. Apply tokens using CSS
custom properties. `ponpoko.host.drop` carries Host-mediated file drops. Keep the
Host-reserved keyboard chords: Cmd/Ctrl+K and Cmd/Ctrl+1–9.

A backend is an executable relative to its bundle root. Host calls only declared
methods using JSON-RPC 2.0 over stdin/stdout; emit diagnostic logging on stderr.
Read `PONPOKO_SURFACE_ID`, `PONPOKO_SURFACE_DATA_DIR` and `PONPOKO_HOST_CONTROL`
from the environment. Never embed the private control token in source. Durable
application data belongs in the data directory, not the installed bundle.

[host-ai.d.mts](../host-ai.d.mts) defines the complete AI request surface.
Model slots are owned by Host; surfaces send modality-level `io`, typed `input`,
provider-neutral `options`, and a required per-invocation `budget`. A request id
survives ambiguous outcomes. `validate` is side-effect-free for model inference;
it does not establish that a paid invocation succeeded. A surface backend uses
the generated loopback adapter, which negotiates the digest before invocation.
