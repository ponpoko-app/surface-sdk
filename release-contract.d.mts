import type { PackageSpec } from "./package-contract.mjs";
export interface ReleaseArtifact {
  asset_id: number;
  archive_bytes: number;
  sha256: string;
  bundle_digest: string;
  spec: PackageSpec;
}
export interface ReleaseSubmission {
  format_version: 1;
  github_release_id: number;
  version: string;
  notes: string;
  artifacts: ReleaseArtifact[];
}
export interface CatalogRelease extends Omit<ReleaseSubmission, "artifacts"> {
  uid: string;
  github_repo_id: number;
  repo: string;
  manifest_id: string;
  distribution_commit: string;
  published_at: number;
  artifacts: Array<ReleaseArtifact & { download_url: string }>;
}
export function validateReleaseSubmission(value: unknown): ReleaseSubmission;
export function validateCatalogRelease(value: unknown): CatalogRelease;
export function releasePrecedence(version: string): string;
