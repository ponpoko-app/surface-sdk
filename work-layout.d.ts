export type LayoutKind = "header" | "sidebar" | "content" | "card" | "list" | "form" | "button" | "input" | "chart" | "canvas";
export type LayoutArchetype = "editorial" | "ledger" | "workspace" | "instrument" | "gallery";

export interface LayoutStyle {
  archetype: LayoutArchetype;
  mood?: string;
  accent_hint?: string;
}

export interface LayoutFeature {
  id: string;
  title: string;
  detail?: string;
  enabled: boolean;
}

export interface LayoutFlow {
  title: string;
  steps: string[];
}

export interface LayoutBlock {
  id: string;
  kind: LayoutKind;
  label: string;
  description?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutDocument {
  title: string;
  note: string;
  width: number;
  height: number;
  blocks: LayoutBlock[];
  style_direction?: LayoutStyle;
  inferred_features?: LayoutFeature[];
  happy_flows?: LayoutFlow[];
}

export interface LayoutReview {
  proposals: LayoutDocument[];
  approved: boolean;
  skipped: boolean;
  references?: string[];
}
