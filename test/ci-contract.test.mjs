import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  CI_CONTRACT_VERSION,
  CI_FIXTURE_REQUESTS,
  CI_RUNNERS,
  CI_TARGETS,
  CI_VARIANTS,
  CI_WORKFLOW_PATHS,
  ciChangePlan,
  ciFixture,
  ciPlanDigest,
  ciTemplateText,
  ownerCiPlan,
} from "../ci-contract.mjs";

const fixture = JSON.parse(await readFile(new URL("../fixtures/ci-plan.json", import.meta.url), "utf8"));
const sha256 = value => createHash("sha256").update(value).digest("hex");

const PORTABLE_MANIFEST = { id: "ledger", name: "Ledger", version: "1.0.0", entry: "index.html" };
const NATIVE_MANIFEST = { ...PORTABLE_MANIFEST, backend: { command: "server" } };

function triggers(text) {
  const lines = text.split("\n");
  const start = lines.indexOf("on:");
  assert.ok(start >= 0, "a workflow declares its events");
  const keys = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.trim()) continue;
    if (!line.startsWith(" ")) break;
    if (/^ {2}[A-Za-z_][A-Za-z0-9_-]*:/.test(line)) keys.push(line.trim().slice(0, -1));
  }
  return keys;
}

function block(text, heading, indent) {
  const lines = text.split("\n");
  const start = lines.findIndex(line => line === `${" ".repeat(indent)}${heading}`);
  if (start < 0) return "";
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() && !line.startsWith(" ".repeat(indent + 2))) break;
    body.push(line);
  }
  return body.join("\n");
}

function embedded(text) {
  return [...text.matchAll(/cat > ([\w.-]+) <<'SCRIPT'/g)].map(match => {
    const chunk = text.split(`cat > ${match[1]} <<'SCRIPT'`)[1].split("\n          SCRIPT")[0];
    return { body: `${chunk.split("\n").map(line => line.slice(10)).join("\n")}\n`, name: match[1] };
  });
}

async function withTemplate(purpose, manifest, run) {
  const directory = await mkdtemp(join(tmpdir(), "ponpoko-ci-template-"));
  try {
    const text = ciTemplateText(purpose);
    const scripts = embedded(text);
    assert.ok(scripts.length >= 1, `${purpose} embeds a script`);
    await writeFile(join(directory, "surface.json"), `${JSON.stringify(manifest)}\n`);
    for (const script of scripts) await writeFile(join(directory, script.name), script.body);
    const drafts = join(directory, "drafts", "surface-draft-any");
    mkdirSync(drafts, { recursive: true });
    await writeFile(join(drafts, "surface.json"), `${JSON.stringify(manifest)}\n`);
    await writeFile(join(drafts, "index.html"), "<h1>Surface</h1>\n");
    const output = join(directory, "github-output");
    await writeFile(output, "");
    await run({
      directory,
      scripts: scripts.map(script => script.name),
      execute(name, environment = {}) {
        writeFileSync(output, "");
        const result = spawnSync(process.execPath, [name], {
          cwd: directory,
          encoding: "utf8",
          env: { ...process.env, GITHUB_OUTPUT: output, REQUESTED_VERSION: manifest.version, REQUESTED_REF: `v${manifest.version}`, ...environment },
        });
        return { ...result, output: readFileSync(output, "utf8") };
      },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const outputOf = (text, key) => text.split("\n").find(line => line.startsWith(`${key}=`)).slice(key.length + 1);
const plan = variant => ownerCiPlan(CI_FIXTURE_REQUESTS[variant]);

test("every generated workflow starts only by manual dispatch and never by a push, tag or schedule", () => {
  for (const purpose of ["build", "checks", "release"]) {
    const text = ciTemplateText(purpose);
    assert.deepEqual(triggers(text), ["workflow_dispatch"], `${purpose} is manual only`);
    for (const forbidden of ["push:", "pull_request:", "pull_request_target:", "schedule:", "workflow_run:", "release:", "tags:"]) {
      assert.ok(!text.split("\n").some(line => line.startsWith("  ") && line.trim() === forbidden), `${purpose} has no ${forbidden}`);
    }
    assert.match(text, /github\.event_name == 'workflow_dispatch'/);
  }
  for (const variant of CI_VARIANTS) {
    assert.deepEqual(plan(variant).automatic_workflows, []);
    for (const workflow of plan(variant).workflows) {
      assert.deepEqual(workflow.triggers, ["workflow_dispatch"]);
      assert.equal(workflow.automatic, false);
    }
  }
});

test("windows tests are an unchecked opt-in declared by both the plan and the workflow", () => {
  const text = ciTemplateText("checks");
  const inputs = block(text, "inputs:", 4);
  assert.match(inputs, /^ {6}run_windows:$/m);
  assert.match(block(inputs, "run_windows:", 6), /^ {8}default: false$/m);
  assert.match(text, /if: github\.event_name == 'workflow_dispatch' && inputs\.run_windows/);
  for (const variant of CI_VARIANTS) {
    const declared = plan(variant).windows_tests;
    assert.equal(declared.default, false, `${variant} never enables windows tests by default`);
    assert.equal(declared.input, variant === "local_only" ? "" : "run_windows");
    if (variant !== "local_only") assert.match(inputs, new RegExp(`^ {6}${declared.input}:$`, "m"));
  }
});

test("the embedded planner emits every supported target and drops only an impossible portable row", async () => {
  await withTemplate("build", PORTABLE_MANIFEST, ({ execute }) => {
    const result = execute("plan-targets.mjs");
    assert.equal(result.status, 0, result.stderr);
    const rows = JSON.parse(outputOf(result.output, "include")).include;
    assert.deepEqual(rows.map(row => row.target), [...CI_TARGETS]);
    assert.deepEqual(Object.fromEntries(rows.map(row => [row.target, row.runner])), { ...CI_RUNNERS });
    assert.equal(outputOf(result.output, "portable"), "true");
  });
  for (const purpose of ["build", "release"]) {
    await withTemplate(purpose, NATIVE_MANIFEST, ({ execute }) => {
      const result = execute("plan-targets.mjs");
      assert.equal(result.status, 0, result.stderr);
      const rows = JSON.parse(outputOf(result.output, "include")).include;
      assert.equal(rows.length, 6, `${purpose} skips only the portable row`);
      assert.ok(!rows.some(row => row.target === "any"));
      assert.equal(outputOf(result.output, "portable"), "false");
    });
  }
  await withTemplate("release", NATIVE_MANIFEST, ({ execute }) => {
    const result = execute("plan-targets.mjs", { REQUESTED_VERSION: "9.9.9" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /does not match surface\.json/);
  });
});

test("the draft digest the release workflow writes names every draft file and its bytes", async () => {
  await withTemplate("release", PORTABLE_MANIFEST, ({ directory, execute }) => {
    const result = execute("digest-drafts.mjs");
    assert.equal(result.status, 0, result.stderr);
    const written = JSON.parse(readFileSync(join(directory, "drafts", "digests.json"), "utf8"));
    assert.equal(written.version, PORTABLE_MANIFEST.version);
    assert.deepEqual(written.files.map(file => file.path), ["surface-draft-any/index.html", "surface-draft-any/surface.json"]);
    for (const file of written.files) {
      const bytes = readFileSync(join(directory, "drafts", file.path));
      assert.equal(file.sha256, createHash("sha256").update(bytes).digest("hex"));
      assert.equal(file.bytes, bytes.length);
    }
  });
});

test("all six native targets plus portable any are prepared and the unsupported rows are explicit", () => {
  const portable = plan("public_source");
  assert.deepEqual(portable.targets.map(row => row.target), [...CI_TARGETS]);
  assert.ok(portable.targets.every(row => row.build === "prepared" && row.runtime === "unrun" && row.reason === ""));
  const native = plan("private_source_ci");
  const unsupported = native.targets.find(row => row.target === "any");
  assert.deepEqual({ build: unsupported.build, runtime: unsupported.runtime, reason: unsupported.reason },
    { build: "unsupported", runtime: "unsupported", reason: "native_programs_require_native_target" });
  assert.equal(native.targets.filter(row => row.target !== "any").length, 6);
  assert.ok(native.targets.filter(row => row.build === "prepared").every(row => row.runtime === "unrun"));
  for (const [name, text] of [["build", ciTemplateText("build")], ["release", ciTemplateText("release")]]) {
    for (const target of CI_TARGETS) assert.ok(text.includes(`["${target}", "${CI_RUNNERS[target]}"]`), `${name} runs ${target}`);
    assert.match(text, /filter\(\(\[target\]\) => !\(native && target === "any"\)\)/, `${name} excludes only the unsupported portable row`);
  }
});

test("each source variant writes only into its declared source repository and local-only uploads nothing", () => {
  assert.deepEqual(Object.keys(fixture.plans), [...CI_VARIANTS]);
  const publicSource = plan("public_source");
  assert.equal(publicSource.ci_repo, publicSource.source_repo);
  const privateSource = plan("private_source_ci");
  assert.equal(privateSource.ci_repo, privateSource.source_repo);
  assert.notEqual(privateSource.ci_repo, privateSource.distribution_repo);
  for (const prepared of [publicSource, privateSource]) {
    assert.equal(prepared.workflows.length, 3);
    assert.deepEqual(prepared.workflows.map(workflow => workflow.path), Object.values(CI_WORKFLOW_PATHS).sort());
    for (const workflow of prepared.workflows) assert.ok(workflow.path.startsWith(".github/workflows/"));
  }
  const local = plan("local_only");
  assert.deepEqual(local.workflows, []);
  assert.equal(local.ci_repo, null);
  assert.equal(local.source_repo, null);
  assert.ok(local.targets.every(row => row.build === "not_uploaded" && row.runtime === "not_uploaded"
    && row.reason === "local_only_source_not_uploaded"));
  assert.equal(ciChangePlan(local, { ".github/workflows/owner.yml": sha256("owner") }, {}).writes.length, 0);
});

test("a release request cannot be read two ways and is refused before any workflow exists", () => {
  const base = CI_FIXTURE_REQUESTS.public_source;
  const invalid = [
    { private_ci_opt_in: true },
    { source_repo: null },
    { development: "use_only", private_ci_opt_in: false },
    { development: "unknown" },
    { declared_targets: [] },
    { declared_targets: ["any", "any"] },
    { declared_targets: ["any", "plan9-x86_64"] },
    { distribution_repo: "owner" },
    { source_repo: "owner/../../escape" },
    { native_programs: "yes" },
    { extra: true },
  ];
  for (const patch of invalid) assert.throws(() => ownerCiPlan({ ...base, ...patch }), /surface_ci_request_invalid/);
  assert.throws(() => ownerCiPlan({ ...CI_FIXTURE_REQUESTS.local_only, source_repo: "owner/private-ledger" }), /surface_ci_request_invalid/);
  assert.throws(() => ownerCiPlan({ ...CI_FIXTURE_REQUESTS.private_source_ci, private_ci_opt_in: false }), /surface_ci_request_invalid/);
});

test("the change plan partitions every workflow, preserves unrelated ones and calls drift a conflict", () => {
  const workflows = plan("public_source").workflows;
  const desired = workflows[0];
  const second = workflows[1];
  const owner = { ".github/workflows/owner.yml": sha256("owner") };
  const unchanged = ciChangePlan(plan("public_source"), { [desired.path]: desired.sha256, ...owner }, {});
  assert.deepEqual(unchanged.changes.map(change => change.change), ["unchanged", "add", "add"]);
  assert.deepEqual(unchanged.writes, [second.path, workflows[2].path]);
  assert.deepEqual(unchanged.preserved, [{ path: ".github/workflows/owner.yml", reason: "unrelated_workflow", sha256: owner[".github/workflows/owner.yml"] }]);
  assert.equal(unchanged.writes_source, true);

  const previous = { [desired.path]: "a".repeat(64) };
  const update = ciChangePlan(plan("public_source"), previous, previous);
  assert.equal(update.changes.find(change => change.path === desired.path).change, "update");
  assert.ok(update.writes.includes(desired.path));

  const edited = ciChangePlan(plan("public_source"), { ...previous, ...owner }, {});
  const conflict = edited.changes.find(change => change.path === desired.path);
  assert.equal(conflict.change, "conflict");
  assert.equal(conflict.base_sha256, previous[desired.path]);
  assert.deepEqual(edited.adoptable, [desired.path]);
  assert.ok(!edited.writes.includes(desired.path));
  assert.deepEqual(edited.preserved.map(entry => entry.path), [".github/workflows/owner.yml"]);

  const stale = { [desired.path]: "b".repeat(64) };
  assert.equal(ciChangePlan(plan("public_source"), stale, previous).changes.find(change => change.path === desired.path).change, "conflict");

  assert.throws(() => ciChangePlan(plan("public_source"), { "surface.json": desired.sha256 }, {}), /surface_ci_existing_invalid/);
  assert.throws(() => ciChangePlan(plan("public_source"), { [desired.path]: "not-a-digest" }, {}), /surface_ci_existing_invalid/);
});

test("the plan digest binds every field and ignores key order", () => {
  const source = plan("public_source");
  assert.equal(ciPlanDigest(source), source.digest);
  const reordered = Object.fromEntries(Object.entries(source).reverse());
  assert.equal(ciPlanDigest(reordered), source.digest);
  const patches = [
    { variant: "local_only" },
    { ci_repo: "owner/other" },
    { declared_targets: ["linux-x86_64"] },
    { windows_tests: { default: true, input: "run_windows" } },
    { targets: source.targets.slice(1) },
    { workflows: [] },
  ];
  for (const patch of patches) assert.notEqual(ciPlanDigest({ ...source, ...patch }), source.digest);
});

test("the committed fixture is exactly what the canonical templates render", () => {
  assert.equal(fixture.contract_version, CI_CONTRACT_VERSION);
  assert.deepEqual(fixture, ciFixture());
  for (const [variant, expected] of Object.entries(fixture.plans)) {
    const actual = ownerCiPlan(CI_FIXTURE_REQUESTS[variant]);
    assert.deepEqual(actual, expected, `${variant} matches the fixture`);
    assert.equal(actual.digest, ciPlanDigest(actual), `${variant} digest is self-consistent`);
    for (const workflow of actual.workflows) {
      const text = ciTemplateText(workflow.purpose);
      assert.equal(workflow.sha256, sha256(text), `${variant} ${workflow.path} is the template bytes`);
      assert.equal(workflow.bytes, Buffer.byteLength(text));
    }
  }
});
