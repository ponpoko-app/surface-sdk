import type { SurfaceClient } from "./surface.mjs";

export interface SurfaceStorage {
  get(key: string, options?: { signal?: AbortSignal }): Promise<string | null>;
  set(key: string, value: string, options?: { signal?: AbortSignal }): Promise<void>;
  remove(key: string, options?: { signal?: AbortSignal }): Promise<void>;
}

export declare function createSurfaceStorage(host: Pick<SurfaceClient, "call">): SurfaceStorage;
