import type { SurfaceClient } from "./surface.mjs";

export interface SurfaceStorage {
  get(key: string, options?: { signal?: AbortSignal }): Promise<string | null>;
  set(key: string, value: string, options?: { signal?: AbortSignal }): Promise<void>;
  remove(key: string, options?: { signal?: AbortSignal }): Promise<void>;
  getJson<T>(key: string, fallback: T, options?: { signal?: AbortSignal }): Promise<T>;
  getJson<T = unknown>(key: string, fallback?: undefined, options?: { signal?: AbortSignal }): Promise<T | null>;
  setJson(key: string, value: unknown, options?: { signal?: AbortSignal }): Promise<void>;
}

export declare function createSurfaceStorage(host: Pick<SurfaceClient, "call">): SurfaceStorage;
