# MCP Runtime Test Surface

v0.2 runtime proof requires:

- MCP request frames become MachineActionRecord request records
- MCP response frames become MachineActionRecord response records
- malformed frames become OmissionRecord-linked omission records
- ReplayBundle compiles
- BundleIntegrityResult validates
- no truth, safety, authorization, or admissibility claim is emitted
