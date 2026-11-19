import type { GitRepoView } from "./work-git.d.ts";

export type WorkStatus =
  | "queued"
  | "running"
  | "paused"
  | "needs_input"
  | "stopped"
  | "interrupted"
  | "failed"
  | "completed";

export type WorkPhase =
  | "understand"
  | "design"
  | "build"
  | "install"
  | "try"
  | "repair"
  | "deliver";

export type EvidenceKind = "suite" | "play" | "replay" | "inspect" | "fault" | "acceptance";

export type EvidenceVerdict = "pass" | "fail" | "skipped" | "unmeasured" | "not_applicable";

export type WorkOrigin = "workspace" | "chat" | "cli";

export type WorkLang = "en" | "th";

export type DeliveryPlace = "source" | "installed" | "data";

export type WorkEventType =
  | "snapshot_changed"
  | "phase_changed"
  | "progress_message"
  | "tool_started"
  | "tool_finished"
  | "budget_paused"
  | "input_required"
  | "model_finished"
  | "evidence_recorded"
  | "artifact_changed"
  | "completed"
  | "failed";

export interface WorkGrant {
  grant_id: string;
  allowance_rounds: number;
  allowance_seconds: number;
  allowance_output_bytes: number;
  rounds_at_grant: number;
  elapsed_ms_at_grant: number;
  output_bytes_at_grant: number;
  created_at: number;
}

export interface WorkIdentity {
  work_id: string;
  origin: WorkOrigin;
  workspace_id: string;
  runtime_surface?: string | null;
  thread_id: string | null;
  surface_id: string | null;
  target_revision: string | null;
  created_at: number;
  updated_at: number;
}

export interface WorkLifecycle {
  status: WorkStatus;
  reason_code: string | null;
  human_message: string | null;
  resumable: boolean;
  current_phase: WorkPhase | null;
  active_operation: string | null;
}

export interface WorkBrief {
  user_request: string;
  acceptance: string[];
  appended_acceptance: string[];
  references: string[];
}

export interface WorkDurability {
  schema_version: number;
  revision: number;
  last_event_seq: number;
  owner_instance: string | null;
  lease_expires_at: number | null;
  fencing_token: number;
}

export interface WorkUsage {
  rounds: number;
  elapsed_ms: number;
  output_bytes: number;
  usage: unknown | null;
  grants: WorkGrant[];
}

export interface WorkArtifact {
  source_path: string | null;
  installed_path: string | null;
  data_location: string | null;
  manifest_version: string | null;
  content_ref: string | null;
}

export interface WorkEvidence {
  evidence_id: string;
  kind: EvidenceKind;
  artifact_ref: string;
  verdict: EvidenceVerdict;
  measured_at: number;
  report: unknown;
}

export interface WorkStaleProof {
  evidence_id: string;
  kind: EvidenceKind;
  artifact_ref: string;
  measured_at: number;
}

export interface WorkDelivery {
  summary?: string | null;
  unresolved_findings: unknown[];
  stale_proof: WorkStaleProof[];
  measured_kinds: EvidenceKind[];
  untested: boolean;
  suggested_actions: string[];
  git: GitRepoView | null;
}

export interface WorkInputRequest {
  id: string;
  question: string;
  options: { id: string; label: string; description: string }[];
  allow_text: boolean;
  publication?: {
    digest: string;
    repo: string;
    tag: string;
    name: string;
    commit: string;
    sha256: string;
    archive_bytes: number;
    notes: string;
    risks: { label: string; description: string; paths?: string[] }[];
  };
}

export interface SourceSpace {
  id: string;
  work_id: string;
  surface_id: string;
  source_path: string;
  original_source: string | null;
  preview_id: string | null;
  phase: "preparing" | "editing" | "preview" | "pending" | "applied" | "discarded" | "kept";
}

export interface WorkSnapshot {
  source_space?: SourceSpace | null;
  input_request?: WorkInputRequest | null;
  layout_review?: import("./work-layout.d.ts").LayoutReview | null;
  protocol_version: number;
  identity: WorkIdentity;
  lifecycle: WorkLifecycle;
  brief: WorkBrief;
  durability: WorkDurability;
  usage: WorkUsage;
  artifact: WorkArtifact;
  evidence: WorkEvidence[];
  delivery: WorkDelivery;
}

export interface WorkEvent {
  work_id: string;
  seq: number;
  event_id: string;
  revision: number;
  protocol_version: number;
  event_type: WorkEventType;
  payload: Record<string, unknown>;
  created_at: number;
}

export interface WorkEventsPage {
  work_id: string;
  cursor: number;
  events: WorkEvent[];
  snapshot?: WorkSnapshot;
  exhausted: boolean;
}

export interface WorkBudgetRequest {
  rounds: number;
  seconds: number;
  output_bytes: number;
}

