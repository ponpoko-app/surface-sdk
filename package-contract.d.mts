export type PackageTarget = "any" | "darwin-aarch64" | "darwin-x86_64" | "windows-aarch64" | "windows-x86_64" | "linux-aarch64" | "linux-x86_64";
export interface PackageSource {
  repo: string;
  commit: string;
  license: string;
  build: string[];
  targets: PackageTarget[];
}
export type PackageDevelopment = { mode: "use_only" } | { mode: "customizable"; source: PackageSource };
export interface PackageSpec {
  format_version: 1;
  target: PackageTarget;
  minimum_host_version: string;
  development: PackageDevelopment;
}
export interface PackageFile { path: string; bytes: number; sha256: string; executable: boolean }
export interface PackageMetadata {
  format: "ponpoko.surface";
  spec: PackageSpec;
  id: string;
  version: string;
  bundle_digest: string;
  files: PackageFile[];
}
export const PACKAGE_TARGETS: readonly PackageTarget[];
export function validatePackageSpec(value: unknown): PackageSpec;
export function validatePackageMetadata(value: unknown): PackageMetadata;
export function validatePackagePath(value: unknown): string;
export function validatePackageVersion(value: unknown): string;
