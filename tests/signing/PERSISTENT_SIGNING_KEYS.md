# Persistent signing key gate

v0.3.1 requires:

- generate persistent Ed25519 private key
- sign at least two bundles with the same key
- both envelopes contain the same public_key_fingerprint
- both envelopes verify
- tampered bundle fails verification
- no truth, safety, or authorization claim appears
