export type LayoutKind = "header" | "sidebar" | "content" | "card" | "list" | "form" | "button" | "input" | "chart" | "canvas";
export interface LayoutBlock { id: string; kind: LayoutKind; label: string; x: number; y: number; width: number; height: number }
export interface LayoutDocument { title: string; note: string; width: number; height: number; blocks: LayoutBlock[] }
export interface LayoutReview { proposals: LayoutDocument[]; approved: boolean; skipped: boolean; references?: string[] }
