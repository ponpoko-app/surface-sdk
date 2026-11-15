import type { SearchRequest, SearchResponse } from "./research.d.mts";
export declare function createBackendResearch(options?: { control?: string; surfaceId?: string }): {
  search(input: SearchRequest): Promise<SearchResponse>;
};
