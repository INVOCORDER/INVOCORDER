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
