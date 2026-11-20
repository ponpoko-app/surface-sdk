import type { BrokerControl, BrokerErrorBody, BrokerRequest, HostAppearance } from "./protocol.ts";
import type { Transport } from "./surface.mjs";

export type MockHostReply =
  | { ok: true; result: unknown }
  | { ok: false; error: Omit<BrokerErrorBody, "retryable"> & { retryable?: boolean } };

export interface MockHostOptions {
  view?: string;
  hello?: Partial<Pick<BrokerControl, "protocol" | "contracts" | "doors">>;
  onRequest?: (request: BrokerRequest) => MockHostReply | undefined | Promise<MockHostReply | undefined>;
}

export interface MockHost {
  readonly view: string;
  readonly transport: Transport;
  readonly requests: readonly BrokerRequest[];
  setPalette(tokens: Record<string, string>, appearance?: HostAppearance): void;
  drop(paths: readonly string[]): void;
}

export declare function createMockHost(options?: MockHostOptions): MockHost;
