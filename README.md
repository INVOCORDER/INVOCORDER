# INVOCORDER

INVOCORDER is the machine-action evidence substrate.

It records what crossed the boundary when an AI agent, model-driven process, MCP client, tool runner, workflow agent, browser agent, desktop agent, or autonomous system touches the world.

INVOCORDER emits hash-chained Machine Action Records and replayable Evidence Bundles.

It does not decide whether an action was safe.
It does not decide whether an action was authorized.
It does not decide whether an action was admissible.
It does not decide whether an action was true.

It records the boundary facts before anyone argues about what they mean.

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
