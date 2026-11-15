import { validatePackageSpec, validatePackageVersion } from "./package-contract.mjs";

const fail = message => { throw new Error(message); };
const hash = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const positive = value => Number.isSafeInteger(value) && value > 0;
const canonical = value => JSON.stringify(sort(value));

function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])]));
  return value;
}

function object(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).length !== fields.length || Object.keys(value).some(key => !fields.includes(key))) {
    fail("surface_release_invalid: unexpected fields");
  }
}

export function releasePrecedence(version) {
  validatePackageVersion(version);
  return version.split(/[+-]/, 1)[0].split(".").map(part => part.padStart(20, "0")).join(".");
}

export function validateReleaseSubmission(value) {
  object(value, ["format_version", "github_release_id", "version", "notes", "artifacts"]);
  validatePackageVersion(value.version);
  if (value.format_version !== 1 || !positive(value.github_release_id)
      || typeof value.notes !== "string" || new TextEncoder().encode(value.notes).length > 4096
      || !Array.isArray(value.artifacts) || !value.artifacts.length || value.artifacts.length > 7) {
    fail("surface_release_invalid: invalid release identity, notes or artifact count");
  }
  const ids = new Set(), targets = new Set();
  let development = null;
  for (const artifact of value.artifacts) {
    object(artifact, ["asset_id", "archive_bytes", "sha256", "bundle_digest", "spec"]);
    validatePackageSpec(artifact.spec);
    if (!positive(artifact.asset_id) || !positive(artifact.archive_bytes) || artifact.archive_bytes > 100663296
        || !hash(artifact.sha256) || !hash(artifact.bundle_digest)
        || ids.has(artifact.asset_id) || targets.has(artifact.spec.target)) {
      fail("surface_release_invalid: invalid or duplicate artifact");
    }
    const declaration = canonical(artifact.spec.development);
    if (development !== null && development !== declaration) fail("surface_release_invalid: artifact development declarations differ");
    development = declaration;
    ids.add(artifact.asset_id);
    targets.add(artifact.spec.target);
  }
  return value;
}

export function validateCatalogRelease(value) {
  object(value, ["format_version", "uid", "github_repo_id", "repo", "github_release_id", "manifest_id",
    "distribution_commit", "version", "notes", "published_at", "artifacts"]);
  if (!positive(value.github_repo_id) || value.uid !== `sfc_github_${value.github_repo_id}`
      || typeof value.repo !== "string" || value.repo.length > 140
      || !/^[a-z0-9][a-z0-9_.-]{0,79}\/[a-z0-9][a-z0-9_.-]{0,79}$/.test(value.repo)
      || typeof value.manifest_id !== "string" || value.manifest_id.length > 64 || value.manifest_id === "surfaces"
      || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value.manifest_id)
      || typeof value.distribution_commit !== "string" || !/^[a-f0-9]{40}$/.test(value.distribution_commit)
      || !positive(value.published_at) || !Array.isArray(value.artifacts)) fail("surface_release_invalid: invalid catalog identity");
  const artifacts = value.artifacts.map(artifact => {
    object(artifact, ["asset_id", "archive_bytes", "sha256", "bundle_digest", "spec", "download_url"]);
    let url;
    try { url = new URL(artifact.download_url); } catch { fail("surface_release_invalid: invalid artifact URL"); }
    if (typeof artifact.download_url !== "string" || url.protocol !== "https:" || url.hostname !== "github.com"
        || url.port || url.username || url.password || url.hash || url.search
        || !url.pathname.toLowerCase().startsWith(`/${value.repo}/releases/download/`) || !url.pathname.endsWith(".surface")) {
      fail("surface_release_invalid: artifact left its registered repository");
    }
    const { download_url: _downloadUrl, ...submission } = artifact;
    return submission;
  });
  validateReleaseSubmission({ format_version: value.format_version, github_release_id: value.github_release_id,
    version: value.version, notes: value.notes, artifacts });
  return value;
}
