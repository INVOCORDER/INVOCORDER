import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { verifyHashChain } from "../hash/verify-hash-chain.js";

export function verifyReplayBundle(sessionDir: string, sessionId: string): { object_type: string; schema_version: string; session_id: string; valid: boolean; errors: string[] } {
  const recordsPath = join(sessionDir, "records.jsonl");
  const records = existsSync(recordsPath)
    ? readFileSync(recordsPath, "utf8").trim().split("\n").filter(Boolean).map((line: string) => JSON.parse(line))
    : [];

  const result = verifyHashChain(records);
  const output = {
    object_type: "INVOCORDER_BUNDLE_INTEGRITY_RESULT",
    schema_version: "0.1.0",
    session_id: sessionId,
    valid: result.valid,
    errors: result.errors
  };

  writeFileSync(join(sessionDir, "bundle-integrity-result.json"), JSON.stringify(output, null, 2) + "\n");
  return output;
}
