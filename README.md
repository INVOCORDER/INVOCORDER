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
