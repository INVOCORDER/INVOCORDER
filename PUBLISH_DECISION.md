# Publish Decision: @invocorder/recorder v0.3.3

Decision status: candidate.

This document records the explicit publish decision boundary for `@invocorder/recorder`.

## Current release state

- local process boundary capture exists
- MCP stdio JSONL boundary capture exists
- MachineActionRecord emission exists
- OmissionRecord emission exists
- ReplayBundle emission exists
- external bundle verifier exists
- signed bundle envelope exists
- persistent signing keys exist
- MCP hostile fixture runner exists
- signed bundle hostile fixture runner exists
- npm pack --dry-run passes

## License posture

The recorder runtime is not Apache-2.0.

Runtime license posture:

- AGPL-3.0-only by default
- commercial license available for proprietary, SaaS, embedded, hosted, or enterprise use that cannot comply with AGPL-3.0

The package keeps:

- `license: SEE LICENSE IN LICENSE`
- `LICENSE`
- `COMMERCIAL-LICENSE.md`

## Non-claims

Publishing the package does not mean INVOCORDER is:

- a firewall
- a policy engine
- a governance system
- an authorization system
- a truth verifier
- an admissibility engine
- a SIEM
- an observability dashboard
- a risk scorer
- an agent approval system

INVOCORDER records machine-action boundary facts.

It may prove bundle integrity and signature integrity.

It may not prove truth, safety, authorization, admissibility, or legitimacy.

## Publish gate

The package may be published only if this PR passes:

- build
- package metadata audit
- npm pack dry-run
- local MCP capture smoke
- external verifier valid-bundle smoke
- external verifier tamper-failure smoke
- signed bundle verification smoke
- signed bundle tamper-failure smoke
- signed fixture runner
- no-overclaim checks
