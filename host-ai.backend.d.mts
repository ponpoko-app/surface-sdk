import type { HostAi } from "./host-ai.mjs";
export { resolveContextBudget, estimateInputTokens, compactInputParts } from "./host-ai.mjs";
export type { AiContextBudget, AiContextBudgetOptions, AiTokenEstimate, AiTokenEstimateOptions, AiCompactOptions, AiCompactResult } from "./host-ai.mjs";
export declare function createBackendAi(options?: { control?: string; surfaceId?: string }): HostAi;
