# Owner CI contract

Version 1 of the owner CI contract ships three deterministic GitHub Actions
templates and computes the reviewable file-change plan a surface owner approves
before anything is written. Ponpoko's shared work service renders the same plan
from the same template bytes, so the SDK and the Host cannot disagree.

## Templates

| Path | Purpose |
| --- | --- |
| `.github/workflows/surface-check.yml` | Build, test and bundle checks on Linux |
| `.github/workflows/surface-build.yml` | One build per native target plus a portable bundle |
| `.github/workflows/surface-release.yml` | Draft run artifacts for review, never a published release |

The files in `ci/` are the canonical bytes. A generated workflow has no
parameters: the version, repositories and target support are resolved into the
plan, and the workflows read `surface.json` where a per-project answer matters.

Every template answers only `workflow_dispatch`. A push, tag, pull request,
schedule or other workflow never starts a build, test or release. Windows tests
are the `run_windows` input, unchecked by default, and its job runs only when the
person ticks it. Deployment is the only workflow that may ever be automatic, so
this contract generates no deploy workflow at all: publishing stays a reviewed
action in Ponpoko, not a CI side effect.

## Targets

The build matrix covers `any` and the six native targets: `darwin-aarch64`,
`darwin-x86_64`, `windows-aarch64`, `windows-x86_64`, `linux-aarch64` and
`linux-x86_64`. A surface that declares a `backend` or `cli` program cannot ship
a portable bundle, so its `any` row is `unsupported` with the reason
`native_programs_require_native_target` and the matrix leaves it out.

Prepared is not run. Every prepared row carries `runtime: "unrun"` until a
person dispatches it, and a dispatch proves one runner, not the six. Partial
target releases remain honest: release only the targets that were built and
measured.

## Project variants

| Variant | When | Where workflows are written |
| --- | --- | --- |
| `public_source` | Customizable with public source | The public source repository |
| `private_source_ci` | Use only with explicit private hosting opt-in | The separate private source repository |
| `local_only` | Use only with local builds | Nowhere: no source is uploaded, so no CI is prepared |

`local_only` returns an empty workflow list, `ci_repo: null` and
`build: "not_uploaded"` on every target. Nothing in that plan may write a file.

## Change plan

`ciChangePlan(plan, existing, recorded)` takes the hashes of the files present
under `.github/workflows/` and the hashes this contract wrote before, and returns:

- `changes`: one row per planned workflow, with `add`, `update`, `unchanged` or
  `conflict`, and the base hash that was reviewed;
- `preserved`: existing workflows this contract does not own, never touched;
- `orphaned`: files it wrote earlier that the new plan no longer contains,
  reported and never deleted;
- `adoptable`: conflicts, which a person must name explicitly to replace;
- `plan_digest`: the digest of the plan the owner reviewed.

A file that matches the recorded hash is an `update`. A file that matches
neither the plan nor the record is a `conflict`: preparing CI never overwrites an
owner's hand-written workflow and never edits it silently. The Host re-checks
every base hash before writing, so an edit between review and apply is drift and
the apply is refused instead of applied to the wrong bytes.

## What preparing CI does not do

It does not create a repository, push, publish, deploy, register with Cloud or
dispatch a workflow. It does not read a credential and never puts one in the
plan: the templates use no secret, and a private source repository's artifacts
stay in that repository's own run artifacts. Obfuscation, packaging, the exact
artifact review and the publication confirmation remain Ponpoko actions after
the build exists.
