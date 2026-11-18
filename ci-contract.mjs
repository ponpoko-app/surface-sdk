import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const CI_CONTRACT_VERSION = 1;

export const CI_TARGETS = Object.freeze([
  "any",
  "darwin-aarch64",
  "darwin-x86_64",
  "windows-aarch64",
  "windows-x86_64",
  "linux-aarch64",
  "linux-x86_64",
]);

export const CI_RUNNERS = Object.freeze({
  any: "ubuntu-24.04",
  "darwin-aarch64": "macos-15",
  "darwin-x86_64": "macos-15-intel",
  "windows-aarch64": "windows-11-arm",
  "windows-x86_64": "windows-latest",
  "linux-aarch64": "ubuntu-24.04-arm",
  "linux-x86_64": "ubuntu-24.04",
});

export const CI_WORKFLOW_PATHS = Object.freeze({
  build: ".github/workflows/surface-build.yml",
  checks: ".github/workflows/surface-check.yml",
  release: ".github/workflows/surface-release.yml",
});

const TEMPLATES = Object.freeze({
  [CI_WORKFLOW_PATHS.build]: "surface-build.yml",
  [CI_WORKFLOW_PATHS.checks]: "surface-check.yml",
  [CI_WORKFLOW_PATHS.release]: "surface-release.yml",
});

const WORKFLOW_PURPOSES = Object.freeze({
  [CI_WORKFLOW_PATHS.build]: "build",
  [CI_WORKFLOW_PATHS.checks]: "checks",
  [CI_WORKFLOW_PATHS.release]: "release",
});

export const CI_VARIANTS = Object.freeze(["public_source", "private_source_ci", "local_only"]);

const REPO = /^[a-z0-9][a-z0-9_.-]{0,79}\/[a-z0-9][a-z0-9_.-]{0,79}$/;
const HASH = /^[a-f0-9]{64}$/;

const fail = message => {
  throw new Error(message);
};

const sha256 = value => createHash("sha256").update(value).digest("hex");

function object(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).length !== fields.length
      || Object.keys(value).some(key => !fields.includes(key))) {
    fail("surface_ci_request_invalid: unexpected fields");
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

export function ciTemplateText(purpose) {
  const path = Object.keys(WORKFLOW_PURPOSES).find(candidate => WORKFLOW_PURPOSES[candidate] === purpose);
  if (!path) fail("surface_ci_workflow_unknown: expected checks, build or release");
  return readFileSync(new URL(`./ci/${TEMPLATES[path]}`, import.meta.url), "utf8");
}

export function ciPlanDigest(plan) {
  const { digest: _digest, ...rest } = plan;
  return sha256(JSON.stringify(canonical(rest)));
}

function requestOf(value) {
  object(value, ["development", "distribution_repo", "source_repo", "build_location", "private_ci_opt_in", "declared_targets", "native_programs"]);
  if (!["customizable", "use_only"].includes(value.development)
      || !["local", "github_actions"].includes(value.build_location)
      || typeof value.private_ci_opt_in !== "boolean" || typeof value.native_programs !== "boolean") {
    fail("surface_ci_request_invalid: development, build_location, opt-in and native_programs must be explicit");
  }
  if (!REPO.test(value.distribution_repo ?? "")) fail("surface_ci_request_invalid: distribution_repo is not a canonical owner/repo");
  const source = value.source_repo ?? null;
  if (source !== null && !REPO.test(source)) fail("surface_ci_request_invalid: source_repo is not a canonical owner/repo");
  const targets = value.declared_targets;
  if (!Array.isArray(targets) || !targets.length || targets.length > CI_TARGETS.length
      || new Set(targets).size !== targets.length || targets.some(target => !CI_TARGETS.includes(target))) {
    fail("surface_ci_request_invalid: declared_targets must be distinct supported targets");
  }
  if (value.development === "customizable") {
    if (!source || value.private_ci_opt_in) fail("surface_ci_request_invalid: Customizable needs public source without private CI");
  } else if (value.build_location === "github_actions") {
    if (!value.private_ci_opt_in || !source || source === value.distribution_repo) {
      fail("surface_ci_request_invalid: Use only CI needs opt-in and a separate private source repo");
    }
  } else if (value.private_ci_opt_in || source !== null) {
    fail("surface_ci_request_invalid: local-only Use only never names a source repository");
  }
  return { ...value, source_repo: source, declared_targets: [...targets] };
}

function variantOf(request) {
  if (request.development === "customizable") return "public_source";
  return request.build_location === "github_actions" ? "private_source_ci" : "local_only";
}

function workflowsFor(variant) {
  if (variant === "local_only") return [];
  return Object.keys(WORKFLOW_PURPOSES).sort().map(path => {
    const text = ciTemplateText(WORKFLOW_PURPOSES[path]);
    return {
      automatic: false,
      bytes: Buffer.byteLength(text),
      path,
      purpose: WORKFLOW_PURPOSES[path],
      sha256: sha256(text),
      triggers: ["workflow_dispatch"],
    };
  });
}

function targetsFor(variant, nativePrograms) {
  return CI_TARGETS.map(target => {
    if (variant === "local_only") {
      return { build: "not_uploaded", reason: "local_only_source_not_uploaded", runner: CI_RUNNERS[target], runtime: "not_uploaded", target };
    }
    if (target === "any" && nativePrograms) {
      return { build: "unsupported", reason: "native_programs_require_native_target", runner: CI_RUNNERS[target], runtime: "unsupported", target };
    }
    return { build: "prepared", reason: "", runner: CI_RUNNERS[target], runtime: "unrun", target };
  });
}

export function ownerCiPlan(value) {
  const request = requestOf(value);
  const variant = variantOf(request);
  const plan = {
    automatic_workflows: [],
    ci_repo: variant === "local_only" ? null : request.source_repo,
    contract_version: CI_CONTRACT_VERSION,
    declared_targets: request.declared_targets,
    development: request.development,
    distribution_repo: request.distribution_repo,
    source_repo: request.source_repo,
    targets: targetsFor(variant, request.native_programs),
    variant,
    windows_tests: { default: false, input: variant === "local_only" ? "" : "run_windows" },
    workflows: workflowsFor(variant),
  };
  return { ...plan, digest: ciPlanDigest(plan) };
}

function hashes(value, label) {
  const result = new Map();
  for (const [path, sha] of Object.entries(value ?? {})) {
    if (!path.startsWith(".github/workflows/") || path.includes("..") || !HASH.test(sha ?? "")) {
      fail(`surface_ci_${label}_invalid: expected workflow paths and sha256 digests`);
    }
    result.set(path, sha);
  }
  return result;
}

export function ciChangePlan(plan, existing, recorded) {
  const desired = new Map(plan.workflows.map(workflow => [workflow.path, workflow.sha256]));
  const present = hashes(existing, "existing");
  const written = hashes(recorded, "recorded");
  const changes = [...desired.keys()].sort().map(path => {
    const sha = desired.get(path);
    const base = present.get(path);
    const change = base === undefined ? "add"
      : base === sha ? "unchanged"
        : written.get(path) === base ? "update" : "conflict";
    return { base_sha256: base ?? "", change, path, sha256: sha };
  });
  const preserved = [...present.keys()].filter(path => !desired.has(path)).sort()
    .map(path => ({ path, reason: "unrelated_workflow", sha256: present.get(path) }));
  const orphaned = [...written.keys()].filter(path => !desired.has(path)).sort()
    .map(path => ({ path, reason: "recorded_workflow_not_in_plan", sha256: written.get(path) }));
  const writes = changes.filter(change => change.change === "add" || change.change === "update").map(change => change.path);
  return {
    adoptable: changes.filter(change => change.change === "conflict").map(change => change.path),
    changes,
    ci_repo: plan.ci_repo,
    contract_version: CI_CONTRACT_VERSION,
    orphaned,
    plan_digest: plan.digest,
    preserved,
    variant: plan.variant,
    writes,
    writes_source: writes.length > 0,
  };
}

export const CI_FIXTURE_REQUESTS = Object.freeze({
  public_source: {
    build_location: "github_actions",
    declared_targets: ["any"],
    development: "customizable",
    distribution_repo: "owner/ledger",
    native_programs: false,
    private_ci_opt_in: false,
    source_repo: "owner/ledger",
  },
  private_source_ci: {
    build_location: "github_actions",
    declared_targets: ["darwin-aarch64", "linux-x86_64"],
    development: "use_only",
    distribution_repo: "owner/ledger",
    native_programs: true,
    private_ci_opt_in: true,
    source_repo: "owner/private-ledger",
  },
  local_only: {
    build_location: "local",
    declared_targets: ["darwin-aarch64"],
    development: "use_only",
    distribution_repo: "owner/ledger",
    native_programs: true,
    private_ci_opt_in: false,
    source_repo: null,
  },
});

export function ciFixture() {
  return {
    contract_version: CI_CONTRACT_VERSION,
    plans: Object.fromEntries(Object.entries(CI_FIXTURE_REQUESTS).map(([variant, request]) => [variant, ownerCiPlan(request)])),
  };
}
