const colors = {
  canvas: "base", panel: "panel", surface: "surface", raised: "elevated", text: "fg",
  muted: "fg-muted", accent: "accent", "on-accent": "on-accent", border: "border",
  "border-strong": "border-strong", focus: "ring", danger: "danger", attention: "attention",
  hover: "panel-hover", selection: "accent-soft",
};
const type = { body: "size-body", ui: "size-ui", code: "size-code", font: "font", mono: "font-mono" };

function legacyMode(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "light";
  const linear = [1, 3, 5].map(index => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722 > .4 ? "light" : "dark";
}

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
  const off = client.onPalette((tokens, appearance) => {
    clear();
    root.dataset.ppHostTheme = appearance?.theme === "light" || appearance?.theme === "dark" ? appearance.theme : legacyMode(tokens.base);
    for (const [role, source] of Object.entries(colors)) {
      const legacy = tokens[source.replaceAll("-", "_")];
      let value = role === "focus" && /^#[0-9a-f]{6}$/i.test(legacy)
        ? legacy
        : appearance?.colors?.[`--color-${source}`];
      if (!value && /^#[0-9a-f]{6}$/i.test(legacy)) {
        value = role === "border" ? `color-mix(in srgb, ${legacy} 18%, transparent)` : legacy;
      }
      set(role, value);
    }
    for (const [source, role] of Object.entries(type)) set(role, appearance?.typography?.[source]);
  });
  return () => { off(); clear(); };
}
