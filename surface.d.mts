import type { BrokerControl, BrokerEvent, ErrorCode, HostAppearance } from "./protocol.ts";
import type { SearchRequest, SearchResponse } from "./research.d.mts";
import type { AiEventRow, AiReceipt, AiRequestOptions, HostAi } from "./host-ai.mjs";
import type { HostOperations, WorkEventsPage, WorkSnapshot } from "./host-operations.d.mts";
export type { HostOperations, WorkEventsPage, WorkSnapshot } from "./host-operations.d.mts";
export type { SearchRequest, SearchResponse, SearchResult } from "./research.d.mts";
export type { HostAppearance } from "./protocol.ts";

export type HostErrorCode = ErrorCode | "ai_contract_mismatch" | "unknown_outcome" | "aborted";
export interface HostErrorDetails {
  retryable?: boolean;
  request_id?: string;
  cursor?: number;
  snapshot?: WorkSnapshot;
  cloud_request_id?: string;
  retry?: { retryable: boolean; after_seconds?: number };
}
export declare class HostError extends Error {
  constructor(code: HostErrorCode, message: string, details?: HostErrorDetails);
  readonly code: HostErrorCode;
  readonly retryable: boolean;
  readonly request_id?: string;
  readonly cursor?: number;
  readonly snapshot?: WorkSnapshot;
  readonly cloud_request_id?: string;
  readonly retry?: HostErrorDetails["retry"];
}
export interface Transport {
  post(value: unknown): void;
  subscribe(handler: (message: unknown) => void): () => void;
}
export interface CompatibilityResult {
  protocol: number;
  ai: { version: number; schema_sha256: string } | null;
  paid_requests: 0;
  inference: "unmeasured";
}
type FollowOptions = AiRequestOptions & { after?: number; intervalMs?: number };
type HostNamespace = keyof HostOperations;
type HostOperation<N extends HostNamespace> = keyof HostOperations[N];
type CallArgs<T> = T extends [undefined, unknown]
  ? [payload?: Record<string, never>, options?: AiRequestOptions]
  : T extends [infer Input, unknown]
    ? {} extends Input ? [payload?: Input, options?: AiRequestOptions] : [payload: Input, options?: AiRequestOptions]
    : never;
type CallResult<T> = T extends [unknown, infer Output] ? Output : never;
export interface SurfaceClient {
  research: { search(input: SearchRequest, options?: AiRequestOptions): Promise<SearchResponse> };
  ai: HostAi;
  ready(): Promise<BrokerControl>;
  call<N extends HostNamespace, O extends HostOperation<N>>(
    namespace: N, operation: O, ...args: CallArgs<HostOperations[N][O]>
  ): Promise<CallResult<HostOperations[N][O]>>;
  backend<T = unknown>(method: string, params?: unknown, options?: AiRequestOptions): Promise<T>;
  checkCompatibility(options?: { ai?: boolean }): Promise<CompatibilityResult>;
  workEvents(workId: string, options?: FollowOptions): AsyncGenerator<WorkEventsPage, void>;
  inferenceEvents(requestId: string, options?: FollowOptions): AsyncGenerator<AiEventRow, Extract<AiReceipt, { found: true }> | void>;
  onPalette(handler: (tokens: Record<string, string>, appearance?: HostAppearance) => void): () => void;
  onDrop(handler: (paths: string[]) => void): () => void;
  onEvent(handler: (event: BrokerEvent & { type: "providers-changed"; payload: Record<string, never> }) => void): () => void;
  dispose(): void;
}
export declare function checkHost(hello: BrokerControl, options?: { ai?: boolean }): CompatibilityResult;
export declare function parentTransport(frame?: Window): Transport;
export declare function createSurfaceClient(options?: { view?: string | null; transport?: Transport; timeoutMs?: number }): SurfaceClient;
