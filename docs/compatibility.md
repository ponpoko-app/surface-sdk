# Compatibility evidence

`npm test` verifies the exported assets' digests, request validation, handshake
scope, version mismatch, timeouts, disposal and negative bundle examples. It
uses a simulated parent and local fixtures, never a provider. It runs without
the private Host repository. Tests that cannot reach a Host do not label that
Host compatible.

`node scripts/check-surface.mjs <bundle>` checks manifest fields and declared
entry/program files, rejects paths leaving the bundle, and checks the required
AI schema and representative requests against this SDK. It reports
`offline_contract_verified`, `host: unmeasured`, `paid_requests: 0`, and leaves
inference and visual behavior unmeasured. This is a preflight; native install
still enforces its filesystem, signature, size and Host-specific rules.

Inside an installed frame, call:

```js
const evidence = await client.checkCompatibility({ ai: true });
```

This checks the actual parent's protocol and AI descriptor. It neither selects
a provider nor invokes a model. The SDK hello example displays the protocol
check without requiring AI. A captured complete hello message can be used with
`node scripts/check-surface.mjs <bundle> --host-hello <hello.json>` to compare
contracts offline. Such a file is captured evidence only; the CLI cannot prove
its origin or that the Host is still running.

After preflight, use the surface's own tests and a real Ponpoko installation to
verify native installation, backend startup and actual UI behavior. Validate
representative AI requests with the running Host, then try paid inference only
within the user's invocation budget and authorization. Do not call any of those
steps verified from a schema check or a successful build alone.

Refresh generated schema, JS and declaration assets together when the contract
changes. A matching protocol integer without the matching AI digest is not AI
compatibility. SDK Git tags are immutable snapshots; changed bytes require a
new SDK version rather than moving a tag.
