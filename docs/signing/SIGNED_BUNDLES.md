# Signed Bundles

v0.3 target.

Signed bundles add cryptographic custody over replay bundle integrity.

Signing proves:
- signer possessed the private key at signing time
- replay-bundle.json bytes match the signature input
- bundle hash and signature material can be externally checked

Signing does not prove:
- truth
- safety
- authorization
- admissibility
- legitimacy
