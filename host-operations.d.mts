import type { SearchRequest, SearchResponse } from "./research.d.mts";
import type { AiEnvelope, AiWireReply } from "./host-ai.mjs";
import type { WorkBudgetRequest, WorkEventsPage, WorkSnapshot } from "./work-types.d.ts";
export type { WorkEventsPage, WorkSnapshot } from "./work-types.d.ts";
import type { PlatformOperation, SurfaceOperation, WorkOperation } from "./protocol.ts";
import type { ContextFileView, FilePickRequest, PasteAnswer, ProviderView, SettingsDestination } from "./platform-types.d.ts";

type Checked<Operations extends PropertyKey, Map extends Record<Operations, [unknown, unknown]>> = Map;
type WorkId = { work_id: string };
type ProtocolInfo = { protocol: 1; host_version: string; identity: string; contracts: Record<string, { version: number; schema_sha256: string }> };

export interface HostOperations {
  "host.platform": Checked<PlatformOperation, {
    "research.search": [SearchRequest, SearchResponse];
    "ai.request": [AiEnvelope, AiWireReply];
    "protocol.info": [undefined, ProtocolInfo];
    "providers.list": [undefined, ProviderView[]];
    "attachments.pick": [undefined, ContextFileView[]];
    "attachments.read": [{ paths: string[] }, ContextFileView[]];
    "attachments.paste-image": [undefined, ContextFileView];
    "files.save": [{ name?: string }, string | null];
    "preferences.list": [undefined, Array<{ key: string; value: string }>];
    "settings.open": [{ destination: SettingsDestination }, true];
    "link.open": [{ href: string }, true];
  }>;
  "host.work": Checked<WorkOperation, {
    list: [{ workspace_id?: string }, WorkSnapshot[]];
    get: [WorkId, WorkSnapshot];
    "events.subscribe": [WorkId & { after?: number; limit?: number }, WorkEventsPage];
    "events.unsubscribe": [undefined, true];
    "instruction.append": [WorkId & { text: string }, WorkSnapshot];
    pause: [WorkId, WorkSnapshot];
    resume: [WorkId & Partial<WorkBudgetRequest> & { provider_id?: string }, WorkSnapshot];
    stop: [WorkId, WorkSnapshot];
  }>;
  "host.surface": Checked<SurfaceOperation, {
    "tool.file": [FilePickRequest, { path: string | null }];
    "tool.paste": [undefined, PasteAnswer];
    "backend.call": [{ method: string; params?: unknown }, unknown];
  }>;
}
