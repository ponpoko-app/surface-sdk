const colors = {
  canvas: "base", panel: "panel", surface: "surface", raised: "elevated", text: "fg",
  muted: "fg-muted", subtle: "fg-subtle", accent: "accent", "on-accent": "on-accent",
  "accent-secondary": "accent-gold", success: "accent-lime", border: "border",
  "border-strong": "border-strong", focus: "ring", danger: "danger", attention: "attention",
  hover: "panel-hover", selection: "accent-soft",
};
const type = { body: "size-body", ui: "size-ui", code: "size-code", font: "font", mono: "font-mono" };

export function bindSurfaceTheme(client, root = document.documentElement) {
  const applied = new Set();
  function clear() {
    for (const property of applied) root.style.removeProperty(property);
    applied.clear();
    delete root.dataset.ppHostTheme;
  }
  function set(role, value) {
    if (typeof value !== "string" || !value.trim()) return;
    const property = `--pp-host-${role}`;
    root.style.setProperty(property, value);
    applied.add(property);
  }
  const off = client.onPalette((_tokens, appearance) => {
    clear();
    root.dataset.ppHostTheme = appearance?.theme === "light" || appearance?.theme === "dark" ? appearance.theme : "dark";
    for (const [role, source] of Object.entries(colors)) {
      set(role, appearance?.colors?.[`--color-${source}`]);
    }
    for (const [source, role] of Object.entries(type)) set(role, appearance?.typography?.[source]);
  });
  return () => { off(); clear(); };
}
