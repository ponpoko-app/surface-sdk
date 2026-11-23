# __NAME__

Edit `index.html` and `main.ts` for the requested workflow. Call
`host.ready()` when the screen is usable and dispose the client on page close.
With no frame, the page opens as a standalone preview.

- `build.mjs` includes the SDK `tokens` and `components` stylesheets (`sdk-tokens.css`, `sdk-components.css`), and `main.ts` calls `bindSurfaceTheme(host)` so `--pp-*` roles inherit the active Host palette and typography automatically. Add your own `surface.css` to refine or override roles locally; the builder copies it when present. Other static files can be listed under `assets` in `build.mjs`.
- Keep the single navigation contribution in `surface.json`. To add Host AI later,
  declare `requires.ai`, copy the running Host schema from `@host/ai-contract.json`
  into source and add `ai-requests.json` with safe samples for your workflow.
- Add a `test` script to `package.json` and test the actual workflow.
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
from the SDK's `/storage` module for small values that should follow the Host's
backup and restore path. Keep the draft until the write succeeds.
