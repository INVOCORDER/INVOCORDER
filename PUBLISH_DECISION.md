
# Publish Decision: @invocorder/recorder v2.1.0

Decision status: product-experience release candidate.

## Product sentence

Record any command. Get a tamper-evident replay bundle and a readable local report.

## Primary command

```bash
invocorder capture -- npm test
```

## Product surface

* three-second quickstart
* zero-configuration command capture
* readable terminal summary
* self-contained local HTML evidence report
* latest-session discovery
* human and machine-readable inspection
* one-command bundle verification
* installation doctor
* product explanation command
* preserved advanced recording, signing, topology, and integration surfaces

## Evidence engine preserved

* bounded stdout and stderr
* normalized exit and signal facts
* hashed environment facts
* command and argument redaction
* file creation, modification, and deletion effects
* generic boundary JSONL
* MCP stdio capture
* replay-bundle compilation
* hash-chain verification
* persistent Ed25519 signing
* hostile fixture execution

## Required gates

* TypeScript build
* strict tests
* runtime verification
* product-experience verification
* hard product-surface verification
* npm package dry run
* prepublication gate

## Non-claims

Publishing or installing INVOCORDER does not prove truth, safety, authorization, admissibility, legitimacy, approval, or external reality.
