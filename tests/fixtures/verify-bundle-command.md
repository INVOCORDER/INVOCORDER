# verify-bundle command gate

The external bundle verifier must:

- read replay-bundle.json
- recompute bundle hash
- verify artifact hashes
- verify artifact sizes
- verify records.jsonl hash chain
- verify bundle first/last/count values
- reject truth, safety, or authorization overclaims
- write external-bundle-verification-result.json
