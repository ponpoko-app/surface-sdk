import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validatePackageSpec, validatePackageMetadata, validatePackagePath, PACKAGE_TARGETS } from "../package-contract.mjs";

const fixture = JSON.parse(await readFile(new URL("../fixtures/package-contract.json", import.meta.url), "utf8"));

test("package specs and inventories obey the same golden contract used by Rust", () => {
  for (const spec of fixture.valid_specs) assert.equal(validatePackageSpec(spec), spec);
  for (const spec of fixture.invalid_specs) assert.throws(() => validatePackageSpec(spec));
  assert.equal(validatePackageMetadata(fixture.metadata), fixture.metadata);
  for (const patch of fixture.invalid_metadata_patches) assert.throws(() => validatePackageMetadata({ ...fixture.metadata, ...patch }));
});

test("golden inventory hashes every original byte and uses the host canonical bundle digest", () => {
  const digest = createHash("sha256");
  for (const file of fixture.metadata.files) {
    const content = Buffer.from(fixture.bundle[file.path]);
    assert.equal(content.length, file.bytes);
    assert.equal(createHash("sha256").update(content).digest("hex"), file.sha256);
    digest.update(`${file.path}\n${content.length}\n`).update(content).update("\n");
  }
  assert.equal(digest.digest("hex"), fixture.metadata.bundle_digest);
});

test("package paths reject cross-platform escapes and reserved names", () => {
  for (const path of ["/absolute", "../out", "a/../out", "a//b", "a\\b", "a:b", "a\0b", "a\nb", "NUL.txt", "lpt1", "a.", "a ", "a?.js"]) {
    assert.throws(() => validatePackagePath(path), path);
  }
  assert.equal(validatePackagePath("assets/ภาษาไทย.js"), "assets/ภาษาไทย.js");
  assert.equal(PACKAGE_TARGETS.length, 7);
});

test("a source URL or development label cannot replace a concrete source revision", () => {
  const spec = fixture.valid_specs[1];
  for (const patch of [{ repo: "https://github.com/alice/hello" }, { commit: "main" }, { license: "" }, { build: [] }, { targets: [] }]) {
    assert.throws(() => validatePackageSpec({ ...spec, development: { mode: "customizable", source: { ...spec.development.source, ...patch } } }));
  }
});
