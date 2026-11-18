export const CI_CONTRACT_VERSION: 1;

export const CI_TARGETS: readonly [
  "any",
  "darwin-aarch64",
  "darwin-x86_64",
  "windows-aarch64",
  "windows-x86_64",
  "linux-aarch64",
  "linux-x86_64",
];

export const CI_RUNNERS: Readonly<Record<string, string>>;

export const CI_WORKFLOW_PATHS: Readonly<{ build: string; checks: string; release: string }>;

export const CI_VARIANTS: readonly ["public_source", "private_source_ci", "local_only"];

export type CiVariant = "public_source" | "private_source_ci" | "local_only";
export type CiTargetState = "prepared" | "unsupported" | "not_uploaded";

export interface OwnerCiRequest {
  development: "customizable" | "use_only";
  distribution_repo: string;
  source_repo: string | null;
  build_location: "local" | "github_actions";
  private_ci_opt_in: boolean;
  declared_targets: string[];
  native_programs: boolean;
}

export interface OwnerCiWorkflow {
  automatic: false;
  bytes: number;
  path: string;
  purpose: "build" | "checks" | "release";
  sha256: string;
  triggers: ["workflow_dispatch"];
}

export interface OwnerCiTarget {
  target: string;
  runner: string;
  build: CiTargetState;
  runtime: CiTargetState;
  reason: string;
}

export interface OwnerCiPlan {
  automatic_workflows: string[];
  ci_repo: string | null;
  contract_version: 1;
  declared_targets: string[];
  development: "customizable" | "use_only";
  distribution_repo: string;
  source_repo: string | null;
  targets: OwnerCiTarget[];
  variant: CiVariant;
  windows_tests: { default: boolean; input: string };
  workflows: OwnerCiWorkflow[];
  digest: string;
}

export interface CiChange {
  base_sha256: string;
  change: "add" | "update" | "unchanged" | "conflict";
  path: string;
  sha256: string;
}

export interface CiChangePlan {
  adoptable: string[];
  changes: CiChange[];
  ci_repo: string | null;
  contract_version: 1;
  orphaned: { path: string; reason: string; sha256: string }[];
  plan_digest: string;
  preserved: { path: string; reason: string; sha256: string }[];
  variant: CiVariant;
  writes: string[];
  writes_source: boolean;
}

export function ciTemplateText(purpose: "build" | "checks" | "release"): string;

export function ciPlanDigest(plan: OwnerCiPlan): string;

export function ownerCiPlan(request: OwnerCiRequest): OwnerCiPlan;

export function ciChangePlan(
  plan: OwnerCiPlan,
  existing?: Record<string, string>,
  recorded?: Record<string, string>,
): CiChangePlan;

export const CI_FIXTURE_REQUESTS: Readonly<Record<CiVariant, OwnerCiRequest>>;

export function ciFixture(): { contract_version: number; plans: Record<CiVariant, OwnerCiPlan> };
