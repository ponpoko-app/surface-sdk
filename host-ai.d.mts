export type ModelIo = { "inputs": Array<string>; "outputs": Array<string>;  };
export type InputPart = ({ "type": string; "text"?: string | null; "role"?: "user" | "assistant" | "system" | null; "url"?: string | null; "data_base64"?: string | null; "mime_type"?: string | null; "name"?: string | null; "value"?: unknown;  }) & ({ "text": string; [key: string]: unknown; } | { "url": string; [key: string]: unknown; } | { "data_base64": string; [key: string]: unknown; } | { "value": unknown; [key: string]: unknown; });
export type InferenceOptions = { "temperature"?: number; "max_tokens"?: number; "count"?: number; "dimensions"?: number; "top_n"?: number; "seed"?: number; "speed"?: number; "duration"?: number; "voice"?: string; "format"?: string; "size"?: string; "query"?: string; "language"?: string; "aspect_ratio"?: string; "tools"?: Array<{  [key: string]: unknown; }>;  };
export type InferenceRequest = { "request_id": string; "io": ModelIo; "input": Array<InputPart>; "options"?: InferenceOptions; "stream"?: boolean; "budget": { "seconds": number; "output_bytes": number;  };  };
export type AiEnvelope = { "operation": "contract" | "validate" | "invoke" | "invoke_lookup" | "invoke_status" | "invoke_events" | "invoke_stop" | "invoke_job_status" | "invoke_job_cancel" | "slots" | "usage"; "contract_version": 1; "input"?: InferenceRequest; "request_id"?: string; "after"?: number; "check_setup"?: boolean;  };
export type OutputPart = { "type": string; "text"?: string | null; "url"?: string | null; "data_base64"?: string | null; "mime_type"?: string | null; "value"?: unknown; "index"?: number | null; [key: string]: unknown; };
export type InferenceResult = { "output": Array<OutputPart>; "usage"?: unknown; "job"?: { "id": string; "status": string; "progress"?: unknown; "error"?: unknown;  };  };
export interface AiRequestOptions { signal?: AbortSignal }
export type InferenceBudget = InferenceRequest["budget"];
export type AiErrorBody = { code: string; message: string; io?: ModelIo | null };
export type AiReceiptStatus = "running" | "completed" | "failed" | "stopped" | "unknown_outcome";
export type AiReceipt = { found: false } | {
  found: true;
  request_id: string;
  grant_id: string;
  budget: InferenceBudget;
  status: AiReceiptStatus;
  result: InferenceResult | { error: AiErrorBody } | null;
  inspection_required: boolean;
  started?: boolean;
};
export type AiEvent =
  | { type: "started"; grant_id: string }
  | { type: "delta"; output: OutputPart }
  | { type: "job"; result: InferenceResult }
  | { type: Exclude<AiReceiptStatus, "running">; result: InferenceResult | { error: AiErrorBody } }
  | { type: "result"; result: InferenceResult }
  | { type: "error"; error?: unknown };
export type AiEventRow = { seq: number; event: AiEvent };
export type AiEventPage = { cursor: number; events: AiEventRow[] };
export type AiContract = {
  version: number; schema_sha256: string; schema: unknown; sdk: string;
  types: string; backend_sdk: string; validation: string;
};
export type AiValidation = {
  valid: true; contract_version: number; paid_requests: 0;
  setup?: { status: "ready"; inference: "unmeasured" } | { status: "setup_required"; error: AiErrorBody; inference: "unmeasured" };
};
export type AiSlots = {
  local: Array<{ io: ModelIo; provider_id: string; model: string; updated_at: number; context_length?: number | null }>;
  cloud: Array<{ slot_id: string; io: ModelIo | null; alias_id: string; pinned_alias_revision: number | null;
    enabled: boolean; position: number; status: string; reason: string | null; action: string | null;
    phase?: "design" | "build" | "verify" | null; context_length?: number | null;
    max_input_bytes?: number | null; max_output_tokens?: number | null }>;
  managed_by: "administrator" | null;
};
export type AiContextBudgetOptions = {
  phase?: "design" | "build" | "verify" | null;
  max_output_tokens?: number;
  trigger_ratio?: number;
  target_ratio?: number;
};
export type AiContextBudget = {
  source: "local" | "cloud" | "custom" | "none";
  max_context_tokens: number | null;
  max_input_bytes: number | null;
  max_output_tokens: number | null;
  safe_input_tokens: number | null;
  trigger_tokens: number | null;
  target_tokens: number | null;
  trigger_bytes: number | null;
  target_bytes: number | null;
};
export type AiTokenEstimateOptions = {
  overhead_tokens?: number;
  overhead_bytes?: number;
  last_input_tokens?: number;
  last_sent_bytes?: number;
};
export type AiTokenEstimate = { tokens: number; bytes: number; images: number };
export type AiCompactOptions = AiTokenEstimateOptions & {
  keep_recent?: number;
  preserve_system?: boolean;
  summary_header?: string;
  level?: number;
  force?: boolean;
};
export type AiCompactResult = {
  input: InputPart[];
  compacted: boolean;
  omitted_parts: number;
  estimated_tokens: number;
  estimated_bytes: number;
  level: number;
};
export type AiUsage = { object: "ai.usage"; rows: Array<{
  surface_id: string; surface_name: string; io: ModelIo | null; source: "cloud" | "local"; model: string;
  requests: number; input_tokens: number | null; output_tokens: number | null; unknown_usage: number;
  failed: number; unsettled: number; last_used_at: number;
}> };
export type AiWireResult = AiContract | AiReceipt | AiEventPage | AiSlots | AiUsage | AiValidation | InferenceResult | { stopping: boolean };
export type AiWireReply = { ok: true; result: AiWireResult } | { ok: false; error: AiErrorBody };
export declare class AiRequestError extends Error {
  constructor(body: AiErrorBody, requestId?: string);
  readonly code: string;
  readonly io?: ModelIo | null;
  readonly request_id?: string;
}
export interface HostAi {
  readonly contractVersion: AiEnvelope["contract_version"];
  contract(options?: AiRequestOptions): Promise<AiContract>;
  invoke(input: InferenceRequest, options?: AiRequestOptions): Promise<Extract<AiReceipt, { found: true }>>;
  validate(input: InferenceRequest, checkSetup?: boolean, options?: AiRequestOptions): Promise<AiValidation>;
  lookup(requestId: string, options?: AiRequestOptions): Promise<AiReceipt>;
  status(requestId: string, options?: AiRequestOptions): Promise<AiReceipt>;
  events(requestId: string, after?: number, options?: AiRequestOptions): Promise<AiEventPage>;
  stop(requestId: string, options?: AiRequestOptions): Promise<{ stopping: boolean }>;
  jobStatus(requestId: string, options?: AiRequestOptions): Promise<InferenceResult>;
  jobCancel(requestId: string, options?: AiRequestOptions): Promise<InferenceResult>;
  slots(options?: AiRequestOptions): Promise<AiSlots>;
  usage(options?: AiRequestOptions): Promise<AiUsage>;
  contextBudget(io: ModelIo, options?: AiContextBudgetOptions & AiRequestOptions): Promise<AiContextBudget>;
  compactInput(input: InputPart[], io: ModelIo, options?: AiCompactOptions & AiContextBudgetOptions & AiRequestOptions): Promise<AiCompactResult>;
}
export declare function resolveContextBudget(slots: AiSlots, io: ModelIo, options?: AiContextBudgetOptions): AiContextBudget;
export declare function estimateInputTokens(input: InputPart[], options?: AiTokenEstimateOptions): AiTokenEstimate;
export declare function compactInputParts(input: InputPart[], budget?: Partial<AiContextBudget>, options?: AiCompactOptions): AiCompactResult;
export declare function uncertainAiOperation(operation: AiEnvelope["operation"]): boolean;
export declare function createHostAi(transport: (payload: AiEnvelope, options?: AiRequestOptions) => Promise<unknown>): HostAi;
export declare function validateSchema(schema: unknown, rule: unknown, value: unknown, path?: string): void;
export declare const SCHEMA: Record<string, unknown> & { $defs: { InferenceRequest: unknown }; examples: AiEnvelope[] };
export declare const CONTRACT: { version: AiEnvelope["contract_version"]; schema_sha256: string };
declare global { interface Window { ponpoko: { ai: HostAi; [key: string]: unknown }; } }
