export type ContextKind = "text" | "image" | "pdf";

export interface ContextFileView {
  name: string;
  path: string;
  bytes: number;
  kind: ContextKind;
  media_type: string | null;
  content: string;
}

export type SettingsDestination = "general" | "ai" | "surfaces" | "palette" | "tools" | "account" | "model";

export interface FilePickRequest {
  mode: "open" | "save";
  title?: string;
  directory?: boolean;
  defaultPath?: string;
}

export type PasteKind = "file" | "image" | "text" | "nothing";

export interface PasteAnswer {
  kind: PasteKind;
  name: string;
  mime: string;
  bytes: number;
  base64: string;
  paths: string[];
  text: string;
}

export interface ProviderView {
  provider_id: string;
  kind: string;
  base_url: string | null;
  model: string;
  has_key: boolean;
  label: string;
}
