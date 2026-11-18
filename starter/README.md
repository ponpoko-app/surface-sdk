# __NAME__

Edit `index.html`, `main.ts` and `surface.css` to implement the requested
workflow. The sample note form can be replaced. Keep the SDK imports, and send
`host.ready()` after your screen is usable. With no frame, the page opens as a
standalone preview.

- `surface.css` loads after the SDK styles. Set semantic `--pp-*` variables in
  `:root` or on a subtree. Delete a declaration to inherit the Host role again.
- Keep `surface.json` and its single navigation contribution. `requires.ai`
  expresses runtime compatibility. Update `ai-requests.json` for AI workflows.
  The default sample proves the contract locally without invoking a model.
- Replace `note.test.ts` with tests for the actual workflow. Run `bun test`.
- Run `bun install --frozen-lockfile --ignore-scripts` and `bun run build`.
  The SDK tarball under `vendor/` is part of the source. Keep it with `bun.lock`.
  Run `bun add` explicitly when adding dependencies. Local builds use Bun.
- Install `dist/` with `surface_install` and inspect the open surface.
  Include `dist/ponpoko-sdk-license.txt` when distributing the bundle.
  Keep `node_modules/` and `dist/` out of source control.

Cmd/Ctrl+K opens the Host surface switcher. Cmd/Ctrl+1–9 selects a Host favorite.
Use Cmd/Ctrl+Alt+1–9 for local tabs. The desktop captures its reserved shortcuts
while a surface input has focus.

Use `host.call(namespace, operation, payload)` for the typed broker,
`host.onPalette`, `host.onDrop` and `host.onEvent` for pushes and
`host.workEvents(id, { signal })` for the work cursor. Use `host.ai.validate`
for a setup check, and use the caller's explicit action to start inference.
Read the SDK README for receipts, cancellation and media jobs.
