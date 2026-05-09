# Persistent Signing Keys

v0.3.1 target.

Generated-per-bundle signing proves only transient possession.

Persistent signing keys add custody continuity:

- same signer key can sign multiple bundles
- public key can be pinned
- key fingerprint can be recorded
- signed envelopes can be compared across sessions

Persistent signing keys still do not prove:

- truth
- safety
- authorization
- admissibility
- legitimacy
