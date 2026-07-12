# Publish Decision: @invocorder/recorder v2.0.0

Decision status: runtime-completion candidate.

## Implemented runtime surface

- local process execution recording
- bounded stdout and stderr capture
- truncation omission records
- normalized exit and signal capture
- spawn-failure capture
- hashed environment facts
- secret-like environment classification
- command and argument redaction
- file creation, modification, and deletion effects
- generic boundary JSONL recording
- MCP stdio recording
- replay bundle compilation
- hash-chain verification
- persistent Ed25519 signing
- hostile MCP fixture execution
- hostile signed-bundle fixture execution
- readable ecosystem power map

## Required gates

- TypeScript build
- strict runtime tests
- hard product-surface verification
- npm power-plane verification
- ecosystem-map verification
- hostile fixture execution
- signed-bundle verification
- npm package dry run

## Non-claims

Publishing or installing INVOCORDER does not prove truth, safety,
authorization, admissibility, legitimacy, approval, or whole-stack
completion.

INVOCORDER records machine-action boundary facts and may prove bundle
integrity and signature integrity.
