# __NAME__

Edit `index.html`, `surface.css`, and `main.ts` (plus cohesive modules) for the requested workflow.
Wrap startup in `try/catch`, show recoverable inline errors via `#host-banner`, set `document.documentElement.dataset.ppReady = "true"` after initial mount/hydration, call `host.ready()` when usable, and dispose the client on `pagehide`.
With no frame, the page opens as a standalone preview.

- `build.mjs` bundles `main.ts`, copies `surface.css` automatically, and ships SDK `tokens` and `components` stylesheets (`sdk-tokens.css`, `sdk-components.css`). `main.ts` calls `bindSurfaceTheme(host)` so `--pp-*` roles inherit the active Host palette and typography automatically. Other static files can be listed under `assets` in `build.mjs`.
- SDK primitives available out of the box: `.pp-shell`, `.pp-topbar`, `.pp-split`, `.pp-grid`, `.pp-stack`, `.pp-row`, `.pp-panel`, `.pp-card`, `.pp-list`, `.pp-list-item`, `.pp-stat`, `.pp-badge`, `.pp-chip`, `.pp-segmented`, `.pp-banner`, `.pp-toast`, `.pp-empty`, `.pp-table`, `dialog.pp-dialog`, `.pp-kbd`, `.pp-progress`, `.pp-skeleton`, `.pp-button`, `.pp-input`, `.pp-icon-button`, `.pp-num`.
- Keep the single navigation contribution in `surface.json`. To add Host AI later, declare `requires.ai`, copy the running Host schema from `@host/ai-contract.json` into source and add `ai-requests.json` with safe samples for your workflow.
- `package.json` already configures `"test": "bun test"`. Write real `*.test.ts` unit tests covering the core state, calculations, persistence, and edge cases.
- Run `bun install --frozen-lockfile --ignore-scripts` and `bun run build`.
  The SDK tarball under `vendor/` is part of the source. Keep it with `bun.lock`.
  Run `bun add` explicitly when adding dependencies. Local builds use Bun.
- Run `npx ponpoko-surface check dist` for the offline bundle check.
- Install `dist/` with `surface_install` and inspect the open surface.
  Include `dist/ponpoko-sdk-license.txt` when distributing the bundle.
  Keep `node_modules/` and `dist/` out of source control.

Cmd/Ctrl+K opens the Host surface switcher. Cmd/Ctrl+1–9 selects a Host favorite.
Use Cmd/Ctrl+Alt+1–9 for local tabs. The desktop captures its reserved shortcuts
while a surface input has focus.

Use `host.call(namespace, operation, payload)` for the typed broker,
`host.onPalette`, `host.onDrop` and `host.onEvent` for pushes and
`host.workEvents(id, { signal })` for the work cursor. Use `createSurfaceStorage(host)`
from the SDK's `/storage` module (`get`, `set`, `remove`, `getJson`, `setJson`)
for small values that should follow the Host's backup and restore path. Keep the draft until the write succeeds.
