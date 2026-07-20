# INVOCORDER

## Record any command. Get a tamper-evident replay bundle and a readable local report.

```bash
npx --yes @invocorder/recorder@2.1.0 capture -- npm test
```

**No account. No hosted service. No source-code changes.**

INVOCORDER runs the command normally and records the machine-action boundary around it:

- what was requested
- what stdout and stderr crossed the boundary
- how the process exited
- what files changed
- what was redacted
- what could not be captured
- whether the replay bundle remains integrity-valid

The result is machine-readable and immediately understandable by a human.

## Three-second start

```bash
npx --yes @invocorder/recorder@2.1.0 quickstart
```

Then:

```bash
npx --yes @invocorder/recorder@2.1.0 show latest
npx --yes @invocorder/recorder@2.1.0 verify latest
```

## Default product journey

```text
command
  -> machine-action boundary records
  -> explicit redactions and omissions
  -> hash-chained replay bundle
  -> integrity verification
  -> readable local evidence report
```

## Human product commands

| Need                    | Command                          |
| ----------------------- | -------------------------------- |
| Understand INVOCORDER   | `invocorder explain`             |
| Check readiness         | `invocorder doctor`              |
| Try it immediately      | `invocorder quickstart`          |
| Record a real command   | `invocorder capture -- npm test` |
| Read the latest session | `invocorder show latest`         |
| Create the HTML report  | `invocorder report latest`       |
| Verify the bundle       | `invocorder verify latest`       |

## Outputs

```text
.invocorder/sessions/<session-id>/
|-- session.json
|-- records.jsonl
|-- omissions.jsonl
|-- replay-bundle.json
|-- bundle-integrity-result.json
`-- invocorder-report.html
```

## Advanced surfaces

INVOCORDER also supports:

- generic JSONL boundary capture
- MCP stdio capture
- signed evidence bundles
- persistent Ed25519 keys
- hostile fixture execution
- workspace and topology inspection
- public control-chain replay
- runnable adapters

Read:

- `docs/QUICKSTART.md`
- `docs/PRODUCT.md`
- `docs/REPORTS.md`
- `PRODUCT/INVOCORDER_PRODUCT_CONTRACT.json`

## Boundary

INVOCORDER records machine-action boundary facts and may establish replay-bundle integrity.

It does not decide truth, safety, authorization, admissibility, legitimacy, or external reality.

<details>
<summary>Advanced architecture, public control, and release history</summary>

## v0.4.0 — Public Org Perimeter Ledger

INVOCORDER now publishes a machine-readable public org perimeter ledger.

The ledger binds the public component repositories that constitute the INVOCORDER evidence substrate:

- `INVOCORDER/INVOCORDER`
- `INVOCORDER/CAPTURE-CONTRACT`
- `INVOCORDER/EVIDENCE-SCHEMAS`
- `INVOCORDER/HOSTILE-FIXTURES`
- `INVOCORDER/INTEGRATIONS`
- `INVOCORDER/.github`

The verifier checks that each component repository exists publicly, is not archived, uses `main`, exposes required files, and preserves the non-claim boundary.

This proves the public org perimeter and component availability. It does not prove truth, authorization, safety, admissibility, or external reality.

## v0.5.0 — Public hostile fixture consumption receipt

INVOCORDER v0.5.0 adds a public hostile-fixture consumption receipt.

This moves beyond repository perimeter inventory. The verifier consumes `INVOCORDER/HOSTILE-FIXTURES` from public GitHub, pins the consumed fixture files by Git blob SHA and SHA-256, parses the public fixture indexes, and verifies that hostile fixture consumption does not depend on a local sibling checkout or private source.

The receipt proves public fixture consumption and hash verification only. It does not prove truth, authorization, safety, admissibility, or external reality.

## v0.6.0 — Public hostile fixture execution receipt

INVOCORDER v0.6.0 adds a public hostile fixture execution receipt.

This is stronger than public fixture consumption. The verifier clones `INVOCORDER/HOSTILE-FIXTURES` from public GitHub at the SHA named by the v0.5 receipt, then executes the local INVOCORDER fixture runners against that temporary public clone:

- MCP hostile fixtures execute from the public fixture repository.
- Signed-bundle hostile fixtures execute from the public fixture repository.
- Expected fixture outputs are compared.
- No local sibling `HOSTILE-FIXTURES` checkout is required.
- Private source is not required.
- Truth, authorization, safety, admissibility, and external reality are not claimed.

## v0.7.0 — Public Hostile Execution Release Consumption

INVOCORDER v0.7.0 adds a public release-consumption receipt for the v0.6 public hostile fixture execution release.

It verifies that the v0.6 execution receipt and standard are present as public GitHub release assets, downloads them through the public release surface, parses them, checks the receipt validity, preserves the fixture execution result counts, and confirms that the non-claim boundary remains intact.

This proves public release asset consumption and receipt continuity. It does not prove truth, authorization, safety, admissibility, or external reality.

## v0.8.0 — Standalone Public Release Auditor Runner

INVOCORDER v0.8.0 adds a standalone public release auditor runner.

The runner starts from public GitHub release assets for `v0.7.0-public-hostile-execution-release-consumption`, downloads the v0.7 release-consumption standard and receipt, verifies their SHA-256 and canonical JSON hashes, parses the receipt, and confirms that the public hostile execution result counts remain preserved.

The runner does not require a local working tree, local sibling fixture repository, or private source. It preserves the existing non-claim boundary: it does not prove truth, authorization, safety, admissibility, or external reality.

## v0.9.0 — Public Release Auditor Runner Consumption Receipt

INVOCORDER v0.9.0 adds a public consumption receipt for the v0.8 standalone public release auditor runner.

It verifies that an outside auditor can download the v0.8 runner, standard, and receipt from the public GitHub release, hash-check the downloaded runner against the v0.9 consumption standard, execute the runner from a temporary clean directory without a `.git` repository, and confirm that the runner independently verifies the v0.7 release assets.

This proves public consumption of the public auditor runner itself. It does not prove truth, authorization, safety, admissibility, or external reality.

## v1.0.0 — Public audit chain closure

INVOCORDER v1.0.0 adds a public audit chain closure verifier and receipt.

The verifier binds the public chain from:

- v0.4 public org perimeter ledger
- v0.5 public hostile fixture consumption receipt
- v0.6 public hostile fixture execution receipt
- v0.7 public hostile execution release consumption receipt
- v0.8 standalone public release auditor runner
- v0.9 public auditor runner consumption receipt

The v1.0 closure verifies public repository contents for v0.4/v0.5, public release assets for v0.6–v0.9, JSON object types, schema versions, SHA-256 / canonical JSON SHA-256 bindings, non-claim boundaries, and clean temporary execution of the v0.8 public auditor runner.

It does not claim truth, authorization, safety, admissibility, or external reality.


<!-- INVOCORDER_V1_1_CAPABILITY_SUPERVISION_START -->
## INVOCORDER v1.1.0 — Capability Supervision Plane

INVOCORDER v1.1.0 adds a machine-readable capability supervision plane.

It binds:

- the past public audit chain from v0.4 through v1.0,
- the present first-party executable surface: CLI, source modules, compiled runtime surface, verifiers, workflows, docs, receipts, release-consumption layers, and audit assets,
- the future extension boundary for plugins, add-ons, external tool runners, policy engines, schema expansion, hostile fixture expansion, and public release auditors.

The v1.1 ledger does not claim truth, authorization, safety, admissibility, external reality, or unimplemented future capabilities. It proves only that the current public capability surface and declared future extension slots are bounded, hash-verifiable, and non-overclaiming.

Verifier:

```bash
node scripts/verify-capability-supervision-ledger.mjs
```

Primary artifacts:

- `CAPABILITY_SUPERVISION/INVOCORDER_CAPABILITY_SUPERVISION_STANDARD.json`
- `CAPABILITY_SUPERVISION/INVOCORDER_CAPABILITY_SUPERVISION_LEDGER.json`
<!-- INVOCORDER_V1_1_CAPABILITY_SUPERVISION_END -->


<!-- INVOCORDER_V1_2_CAPABILITY_ADMISSION_START -->
## INVOCORDER v1.2.0 — Capability Admission Control

INVOCORDER v1.2.0 adds a public capability admission-control layer.

v1.1 supervises the whole current capability surface. v1.2 controls what may enter next.

Every future plugin, add-on, runner, wire, tool adapter, policy engine, schema expansion, hostile fixture expansion, or public auditor is closed by default until it has a bound capability manifest with:

- source-file and hash basis,
- executable-surface boundary,
- input/output boundary,
- replay or evidence policy,
- dependency, network, secret, and release-asset boundaries,
- explicit non-claims.

The admission registry inherits the v1.1 supervision plane from public release assets and does not grant any new external execution by implication.

Verifier:

```bash
node scripts/verify-capability-admission-control.mjs
```

Primary artifacts:

- `CAPABILITY_ADMISSION/INVOCORDER_CAPABILITY_ADMISSION_STANDARD.json`
- `CAPABILITY_ADMISSION/CAPABILITY_MANIFEST_TEMPLATE.json`
- `CAPABILITY_ADMISSION/INVOCORDER_CAPABILITY_ADMISSION_REGISTRY.json`
<!-- INVOCORDER_V1_2_CAPABILITY_ADMISSION_END -->

## v1.3.0 — Capability Runtime Enforcement Gate

INVOCORDER v1.3.0 adds a runtime enforcement gate over the v1.2 capability admission control layer.

This layer consumes the public v1.2 admission release assets, verifies that future extension slots remain closed by default, and asserts that plugin/add-on/runner/network/secret/policy/schema/fixture/auditor capability execution is denied unless a bound manifest admits it.

It proves only runtime enforcement of the admission boundary. It does not claim truth, authorization, safety, admissibility, or external reality.

## v1.4.0 — Capability Manifest Hostile Fixtures

INVOCORDER v1.4.0 adds hostile capability manifest fixture execution.

It consumes the v1.3 runtime enforcement release, validates capability manifests against the v1.2 admission boundary, and proves rejection of malformed or overclaiming manifests: truth overclaim, authorization overclaim, unimplemented capability overclaim, unsupervised execution overclaim, implicit network capability, implicit secret access, unhashed source, unmanifested runtime execution, missing required boundaries, and external release declarations without release assets.

Non-claims remain preserved: truth, authorization, safety, admissibility, and external reality are not claimed.

## v1.5.0 — External capability release consumption

INVOCORDER v1.5.0 binds external capability admission to public release consumption.

The gate consumes the v1.4.0 capability manifest hostile fixture release assets, verifies their object types, schema versions, validity, byte hashes, and canonical JSON hashes, and records that external capability manifests are not admitted from local-only evidence.

The v1.5 boundary preserves the v1.4 hostile fixture result while strengthening the external admission rule: an external capability candidate must be release-asset-bound, hash-bound, schema-bound, and non-claim-bound before it may be treated as externally consumable.

It does not claim truth, authorization, safety, admissibility, or external reality.

## v1.6.0 — External capability cold replay

INVOCORDER v1.6.0 adds a cold replay gate for external capability release consumption.

The gate copies a standalone replay runner into a fresh temporary directory and executes it outside the local repository. The runner downloads the v1.5.0 external capability release consumption assets from the public release, verifies their object types, schema versions, validity, byte hashes, and canonical JSON hashes, and confirms that local-only external manifest admission remains blocked.

This proves the external capability release boundary can be replayed without a local working tree or private source.

It does not claim truth, authorization, safety, admissibility, or external reality.

## v1.7.0 — External capability bundle index

INVOCORDER v1.7.0 publishes a public external capability bundle index.

The index makes the v1.2 through v1.6 external capability chain discoverable from one public asset. It resolves the admission control, runtime enforcement, hostile manifest fixtures, external release consumption, and cold replay release assets, binds their byte hashes and canonical JSON hashes, and preserves the non-claim boundary.

It lets outside consumers discover the capability chain without guessing release order, without private source, and without a local working tree.

It does not claim truth, authorization, safety, admissibility, or external reality.

## v1.8.0 — External capability bundle cold replay

INVOCORDER v1.8.0 adds cold replay for the external capability bundle index.

The gate copies a standalone replay runner into a fresh temporary directory and executes it outside the local repository. The runner downloads the v1.7.0 external capability bundle index release assets, verifies their object types, schema versions, validity, byte hashes, canonical JSON hashes, chain order, and non-claim boundary, then confirms that the v1.2 through v1.6 external capability chain is discoverable from public release assets only.

This proves outside consumers can replay the capability bundle index without guessing release order, without private source, and without a local working tree.

It does not claim truth, authorization, safety, admissibility, or external reality.

## v1.9.0 — External capability capsule digest

INVOCORDER v1.9.0 publishes an external capability capsule digest.

The digest consumes the v1.8.0 external capability bundle cold replay release assets, verifies the source receipt, binds the source assets by byte hash and canonical JSON hash, and computes a single ordered capsule digest over the public external capability chain scope.

The capsule digest gives consumers one stable digest object for the v1.2 through v1.8 external capability chain while preserving the public-release-asset-only, no-private-source, no-local-working-tree, and non-claim boundaries.

It does not claim truth, authorization, safety, admissibility, or external reality.

## v2.0.0 — Public control chain closure

INVOCORDER v2.0.0 publishes a public control chain closure.

The closure consumes the v1.9.0 external capability capsule digest release assets, verifies the source receipt, binds the capsule digest, computes a closure digest, and records the v1.2 through v1.9 public control chain scope.

The closure gives consumers one bounded public object for the external capability control chain while preserving public-release-asset-only replay, no-private-source replay, no-local-working-tree replay, and the non-claim boundary.

It does not claim truth, authorization, safety, admissibility, or external reality.

<!-- INVOCORDER_NPM_POWER_PLANE_START -->
## NPM power plane — installable capability surface

INVOCORDER now binds its npm power plane as an explicit installable surface.

The native package remains `@invocorder/recorder`. It is not installed as a recursive self-dependency. The external packages are installed as runtime dependencies and are exposed through a typed power-plane registry, verifier, and CLI status command.

Command:

```bash
invocorder power-plane
```

Verifier:

```bash
node scripts/verify-npm-power-plane.mjs
```

Bound external packages:

- `@verifrax/verifrax`
- `@verifrax/verifrax-verify`
- `@verifrax/verifrax-spec`
- `@verifrax/verifrax-profiles`
- `@verifrax/auctoriseal`
- `@verifrax/corpiform`
- `@verifrax/cicullis`
- `@verifrax/sigillarium`
- `@verifrax/archicustos`
- `@verifrax/attestorium`
- `@verifrax/guillotine`
- `@verifrax/irrevocull`
- `@verifrax/kairoclasp`
- `@verifrax/limenward`
- `@verifrax/originseal`
- `@verifrax/validexor`
- `@verifrax/verifrax-api`
- `@verifrax/root`
- `@kaaffilm/mk10-pro`
- `@antimatterium/antimatterium`

This power plane proves package binding and local runtime resolution only. It does not prove truth, authorization, safety, admissibility, recognition, recourse, system completion, or external reality.
<!-- INVOCORDER_NPM_POWER_PLANE_END -->

<!-- INVOCORDER_LOCAL_WORKSPACE_PERIMETER_START -->

## Local workspace perimeter

INVOCORDER can inspect the local `INVOCORDER-org` workspace perimeter when the sibling surfaces are present beside the native repository.

The local perimeter currently binds these surfaces as evidence-bearing adjacent boundaries:

- `INVOCORDER`
- `CAPTURE-CONTRACT`
- `EVIDENCE-SCHEMAS`
- `HOSTILE-FIXTURES`
- `INTEGRATIONS`
- `CINEMATICUM`

This binding is deliberately narrow. Local workspace presence is evidence of operator-visible surfaces. It is not accepted truth, authority issuance, governed execution truth, verification result, terminal recognition, terminal recourse, package truth, host truth, or system completion.

Commands:

```bash
npm run workspace:perimeter
npm run workspace:perimeter:local
invocorder workspace-perimeter --workspace-root .. --require-local
```

The default verifier mode is CI-safe and does not require sibling repositories. The local-required mode is for operator validation from the full workspace root.

<!-- INVOCORDER_LOCAL_WORKSPACE_PERIMETER_END -->

<!-- INVOCORDER_LOCAL_TOPOLOGY_LEDGER_START -->
## Local topology ledger

INVOCORDER can inspect the surrounding local workspace topology without treating that topology as truth, source authority, completion, or an expansion of INVOCORDER's role.

```bash
invocorder local-topology --workspace-root ..
npm run topology:verify
```

The ledger intentionally excludes `node_modules`, `dist`, generated package archives, local session output, and generated media from topology hashing.
<!-- INVOCORDER_LOCAL_TOPOLOGY_LEDGER_END -->



<!-- INVOCORDER_STACKED_PR_LEDGER_START -->
## Stacked PR ledger boundary

INVOCORDER now carries a bounded stacked PR ledger for the current public control chain:

- PR 32 binds the npm power plane.
- PR 33 binds the local workspace perimeter.
- PR 34 binds the local topology ledger.

The ledger records branch/base alignment, check terminality, and review-request presence. It does not claim truth, approval, merge finality, source authority, or system completion.

Verify locally:

```bash
npm run stack:pr-ledger
```

<!-- INVOCORDER_STACKED_PR_LEDGER_END -->


<!-- INVOCORDER_STACK_TERMINALITY_START -->
## Stack terminality ledger

INVOCORDER carries a bounded stack terminality ledger for the current PR chain:

- PR 32: npm power plane.
- PR 33: local workspace perimeter.
- PR 34: local topology ledger.
- PR 35: stacked PR ledger.

The ledger records open state, stack linkage, terminal successful checks, and review-request presence. It does not claim truth, approval, merge finality, source authority, or completion.

Verify locally:

```bash
npm run stack:terminality
```

<!-- INVOCORDER_STACK_TERMINALITY_END -->


## Stack merge readiness ledger

INVOCORDER records a stack merge-readiness ledger for the open public-control pull request chain.

The ledger records PR number, base, head, title, reviewer request, check totals, check success count, pending count, and failing count for the current stack.

This surface is not merge, approval, accepted truth, reviewer consent, terminal recourse, or system completion. It only records that the listed open pull requests were observed with zero pending checks, zero failing checks, matching stack order, and the required reviewer request.


<!-- INVOCORDER_STACK_GREEN_LEDGER_BOUNDARY -->
## Stack green ledger

INVOCORDER publishes a stack green ledger for the currently open stacked pull-request chain.

The ledger records that PR 32 through PR 37 are open, ordered, reviewer-requested, and observed with successful checks at the time of receipt generation.

This does not claim truth, approval, merge, authorization, safety, or system completion. It is a bounded merge-readiness evidence surface only.


<!-- INVOCORDER_STACK_RELEASE_CANDIDATE_BOUNDARY -->
## Stack release-candidate ledger

INVOCORDER records a bounded stack release-candidate ledger for the open green PR chain.

The ledger observes PR 32 through PR 38 as open, ordered, reviewer-requested, and terminal-green at receipt time.

This is not release, approval, merge, publication, accepted truth, safety, authorization, or system completion.


<!-- INVOCORDER_STACK_PUBLICATION_READINESS_BOUNDARY -->
## Stack publication-readiness ledger

INVOCORDER records a bounded publication-readiness ledger over the open green stack.

The ledger observes package name, package version, package file surfaces, required ledger files, PR 32 through PR 39, reviewer-request presence, and terminal-green checks.

This is not publication, release, approval, merge, accepted truth, safety, authorization, or system completion.

### Hard product release gate

INVOCORDER now includes a hard product-surface release gate.

`npm run release:check` is product-local. It does not depend on sibling workspace trees, local generated media, `node_modules`, or ignored build drift as authority. The gate requires strict tests, verifies the committed product surface, machine-parses `npm pack --dry-run --json`, and rejects forbidden package payloads such as workspace media, tarballs, local sessions, or dependency trees.

The hard product gate is not publication, truth, safety, authorization, approval, merge, or system completion.

</details>
