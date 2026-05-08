import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sha256 } from "../hash/hash-record.js";
import { readRecorderVersion } from "../version.js";

function artifact(sessionDir: string, path: string): { path: string; sha256: string; size_bytes: number } {
  const full = join(sessionDir, path);
  const data = existsSync(full) ? readFileSync(full) : Buffer.from("");
  return { path, sha256: sha256(data), size_bytes: data.length };
}

export function compileReplayBundle(sessionDir: string, sessionId: string): unknown {
  const recordsPath = join(sessionDir, "records.jsonl");
  const lines = existsSync(recordsPath)
    ? readFileSync(recordsPath, "utf8").trim().split("\n").filter(Boolean)
    : [];

  const records = lines.map((line: string) => JSON.parse(line));
  const first = records[0]?.record_hash ?? null;
  const last = records.at(-1)?.record_hash ?? null;

  const bundle = {
    object_type: "INVOCORDER_MACHINE_ACTION_EVIDENCE_BUNDLE",
    schema_version: "0.1.0",
    capture_contract_version: "0.1.0",
    session_id: sessionId,
    created_at: new Date().toISOString(),
    recorder: {
      name: "invocorder",
      version: readRecorderVersion(),
      build_sha256: "unknown"
    },
    hash_chain: {
      algorithm: "sha256",
      first_record_hash: first,
      last_record_hash: last,
      record_count: records.length
    },
    artifacts: [
      artifact(sessionDir, "records.jsonl"),
      artifact(sessionDir, "session.json"),
      artifact(sessionDir, "omissions.jsonl")
    ],
    redaction: {
      policy_sha256: "none",
      mode: "none"
    },
    integrity: {
      bundle_sha256: ""
    },
    claims: {
      proves_truth: false,
      proves_safety: false,
      proves_authorization: false,
      proves_integrity: true
    }
  };

  bundle.integrity.bundle_sha256 = sha256(JSON.stringify({ ...bundle, integrity: { bundle_sha256: "" } }));
  writeFileSync(join(sessionDir, "replay-bundle.json"), JSON.stringify(bundle, null, 2) + "\n");
  return bundle;
}
