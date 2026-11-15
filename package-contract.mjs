export const PACKAGE_TARGETS = Object.freeze([
  "any", "darwin-aarch64", "darwin-x86_64", "windows-aarch64", "windows-x86_64", "linux-aarch64", "linux-x86_64",
]);

const encoder = new TextEncoder();
const fail = message => { throw new Error(message); };
const bytes = value => encoder.encode(value).length;
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

function object(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).length !== fields.length
      || Object.keys(value).some(key => !fields.includes(key))) fail("package_metadata_invalid: unexpected fields");
}

export function validatePackageVersion(value) {
  if (typeof value !== "string" || value.length > 64
      || !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/.test(value)) {
    fail("package_version_invalid: expected a semantic version");
  }
  const prerelease = value.split("+", 1)[0].split("-").slice(1).join("-");
  if (prerelease.split(".").some(part => /^0[0-9]+$/.test(part))) fail("package_version_invalid: numeric prerelease has leading zero");
  for (const part of value.split(/[.+-]/).slice(0, 3)) {
    if (BigInt(part) > 18446744073709551615n) fail("package_version_invalid: component exceeds u64");
  }
  return value;
}

function target(value) {
  if (!PACKAGE_TARGETS.includes(value)) fail("package_target_unsupported: unknown target");
}

function source(value) {
  object(value, ["repo", "commit", "license", "build", "targets"]);
  if (typeof value.repo !== "string" || bytes(value.repo) > 140
      || !/^[a-z0-9][a-z0-9_.-]{0,79}\/[a-z0-9][a-z0-9_.-]{0,79}$/.test(value.repo)
      || typeof value.commit !== "string" || !/^[a-f0-9]{40}$/.test(value.commit)
      || typeof value.license !== "string" || bytes(value.license) > 128 || !/^[A-Za-z0-9.+-]+$/.test(value.license)
      || !Array.isArray(value.build) || !value.build.length || value.build.length > 16
      || value.build.some(item => typeof item !== "string" || !item.length || bytes(item) > 256 || /[\0\n\r]/.test(item))
      || !Array.isArray(value.targets) || !value.targets.length || value.targets.length > PACKAGE_TARGETS.length
      || new Set(value.targets).size !== value.targets.length) fail("package_source_invalid: invalid source declaration");
  value.targets.forEach(target);
}

export function validatePackageSpec(value) {
  object(value, ["format_version", "target", "minimum_host_version", "development"]);
  if (value.format_version !== 1) fail("package_format_unsupported: expected format_version 1");
  target(value.target);
  validatePackageVersion(value.minimum_host_version);
  if (value.development?.mode === "use_only") object(value.development, ["mode"]);
  else if (value.development?.mode === "customizable") {
    object(value.development, ["mode", "source"]);
    source(value.development.source);
  } else fail("package_source_invalid: unknown development mode");
  return value;
}

export function validatePackagePath(value) {
  if (typeof value !== "string" || !value.length || bytes(value) > 240 || /[\\:*?<>|"]/.test(value)
      || [...value].some(character => character.charCodeAt(0) < 32 || (character.charCodeAt(0) >= 127 && character.charCodeAt(0) <= 159))
      || value.split("/").some(part => !part || part === "." || part === ".." || /[. ]$/.test(part)
        || bytes(part) > 255 || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(part.split(".", 1)[0]))) {
    fail("package_path_invalid: only portable relative file paths are allowed");
  }
  return value;
}

function compare(left, right) {
  const a = encoder.encode(left), b = encoder.encode(right);
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

export function validatePackageMetadata(value) {
  object(value, ["format", "spec", "id", "version", "bundle_digest", "files"]);
  if (value.format !== "ponpoko.surface" || typeof value.id !== "string" || value.id.length > 64
      || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value.id) || value.id === "surfaces" || !digest(value.bundle_digest)) {
    fail("package_metadata_invalid: invalid format, identity or digest");
  }
  validatePackageSpec(value.spec);
  validatePackageVersion(value.version);
  if (!Array.isArray(value.files) || !value.files.length || value.files.length > 4096) fail("package_limit: invalid file count");
  const folded = new Set();
  let total = 0, previous = null;
  for (const file of value.files) {
    object(file, ["path", "bytes", "sha256", "executable"]);
    validatePackagePath(file.path);
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0 || !digest(file.sha256) || typeof file.executable !== "boolean"
        || (previous !== null && compare(previous, file.path) >= 0) || folded.has(file.path.toLowerCase())) {
      fail("package_metadata_invalid: inventory must be unique, sorted and hashed");
    }
    total += file.bytes;
    if (total > 134217728) fail("package_limit: expanded bundle is too large");
    folded.add(file.path.toLowerCase());
    previous = file.path;
  }
  if (!value.files.some(file => file.path === "surface.json")) fail("package_metadata_invalid: missing manifest");
  if (bytes(JSON.stringify(value)) > 2097152) fail("package_limit: metadata is too large");
  return value;
}
