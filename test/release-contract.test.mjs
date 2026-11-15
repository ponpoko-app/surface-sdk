import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateReleaseSubmission, validateCatalogRelease, releasePrecedence } from "../release-contract.mjs";

const fixture = JSON.parse(await readFile(new URL("../fixtures/release-contract.json", import.meta.url), "utf8"));

test("release identity and artifact inventory are strict and canonical", () => {
  assert.equal(validateReleaseSubmission(fixture.submission), fixture.submission);
  assert.equal(validateCatalogRelease(fixture.release), fixture.release);
  for (const patch of [{ extra: true }, { version: "latest" }, { github_release_id: 0 }, { artifacts: [] },
    { artifacts: [fixture.submission.artifacts[0], fixture.submission.artifacts[0]] }]) {
    assert.throws(() => validateReleaseSubmission({ ...fixture.submission, ...patch }));
  }
});

test("a catalog release cannot point outside its registered repository or impersonate another uid", () => {
  for (const patch of [{ uid: "sfc_github_901" }, { repo: "another/ledger" }, { distribution_commit: "main" }]) {
    assert.throws(() => validateCatalogRelease({ ...fixture.release, ...patch }));
  }
  for (const url of ["http://github.com/owner/ledger/releases/download/v1/file.surface", "https://evil.test/file.surface",
    "https://github.com/owner/ledger/releases/download/v1/file.surface?key=x"]) {
    assert.throws(() => validateCatalogRelease({ ...fixture.release, artifacts: [{ ...fixture.release.artifacts[0], download_url: url }] }));
  }
});

test("stable release ordering is numeric and ignores build metadata", () => {
  assert.ok(releasePrecedence("1.10.0") > releasePrecedence("1.9.9"));
  assert.equal(releasePrecedence("1.0.0+a"), releasePrecedence("1.0.0+b"));
  assert.ok(releasePrecedence("18446744073709551615.0.0") > releasePrecedence("999.0.0"));
});
