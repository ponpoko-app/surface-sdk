import type { BrokerControl, BrokerEvent, Namespace } from "./protocol.ts";
import type { SearchRequest, SearchResponse } from "./research.d.mts";
export type { SearchRequest, SearchResponse, SearchResult } from "./research.d.mts";
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
export declare function checkHost(hello: BrokerControl, options?: { ai?: boolean }): CompatibilityResult;
export declare function parentTransport(frame?: Window): Transport;
export declare function createSurfaceClient(options?: { view?: string | null; transport?: Transport; timeoutMs?: number }): {
  research: { search(input: SearchRequest): Promise<SearchResponse> };
  ready(): Promise<BrokerControl>;
  call<T = unknown>(namespace: Namespace, operation: string, payload?: Record<string, unknown>): Promise<T>;
  backend<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  checkCompatibility(options?: { ai?: boolean }): Promise<CompatibilityResult>;
  onPalette(handler: (tokens: Record<string, string>) => void): () => void;
  onEvent(handler: (event: BrokerEvent) => void): () => void;
  dispose(): void;
};
