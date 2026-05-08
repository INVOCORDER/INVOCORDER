import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { sha256 } from "../hash/hash-record.js";
import { verifyHashChain } from "../hash/verify-hash-chain.js";

type Artifact = {
  path: string;
  sha256: string;
  size_bytes: number;
};

type ReplayBundle = {
  object_type: string;
  schema_version: string;
  session_id: string;
  hash_chain: {
    first_record_hash: string | null;
    last_record_hash: string | null;
    record_count: number;
  };
  artifacts: Artifact[];
  integrity: {
    bundle_sha256: string;
  };
  claims: {
    proves_truth: boolean;
    proves_safety: boolean;
    proves_authorization: boolean;
    proves_integrity: boolean;
  };
};

export function verifyBundleFile(bundlePath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const bundleDir = dirname(bundlePath);

  if (!existsSync(bundlePath)) {
    return { valid: false, errors: [`bundle not found: ${bundlePath}`] };
  }

  const bundle = JSON.parse(readFileSync(bundlePath, "utf8")) as ReplayBundle;

  if (bundle.claims?.proves_truth !== false) errors.push("bundle overclaims truth");
  if (bundle.claims?.proves_safety !== false) errors.push("bundle overclaims safety");
  if (bundle.claims?.proves_authorization !== false) errors.push("bundle overclaims authorization");
  if (bundle.claims?.proves_integrity !== true) errors.push("bundle does not claim integrity");

  const expectedBundleHash = sha256(JSON.stringify({ ...bundle, integrity: { bundle_sha256: "" } }));
  if (bundle.integrity.bundle_sha256 !== expectedBundleHash) {
    errors.push("bundle hash mismatch");
  }

  for (const artifact of bundle.artifacts) {
    const artifactPath = join(bundleDir, artifact.path);

    if (!existsSync(artifactPath)) {
      errors.push(`artifact missing: ${artifact.path}`);
      continue;
    }

    const data = readFileSync(artifactPath);
    const actualHash = sha256(data);

    if (actualHash !== artifact.sha256) {
      errors.push(`artifact hash mismatch: ${artifact.path}`);
    }

    if (data.length !== artifact.size_bytes) {
      errors.push(`artifact size mismatch: ${artifact.path}`);
    }
  }

  const recordsArtifact = bundle.artifacts.find((artifact) => artifact.path === "records.jsonl");

  if (recordsArtifact) {
    const recordsPath = join(bundleDir, recordsArtifact.path);

    if (existsSync(recordsPath)) {
      const records = readFileSync(recordsPath, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line: string) => JSON.parse(line));

      const chain = verifyHashChain(records);
      errors.push(...chain.errors);

      const first = records[0]?.record_hash ?? null;
      const last = records.at(-1)?.record_hash ?? null;

      if (bundle.hash_chain.record_count !== records.length) {
        errors.push("bundle record count mismatch");
      }

      if (bundle.hash_chain.first_record_hash !== first) {
        errors.push("bundle first record hash mismatch");
      }

      if (bundle.hash_chain.last_record_hash !== last) {
        errors.push("bundle last record hash mismatch");
      }
    }
  }

  const output = {
    object_type: "INVOCORDER_EXTERNAL_BUNDLE_VERIFICATION_RESULT",
    schema_version: "0.2.2",
    session_id: bundle.session_id,
    valid: errors.length === 0,
    errors
  };

  writeFileSync(join(bundleDir, "external-bundle-verification-result.json"), JSON.stringify(output, null, 2) + "\n");

  return output;
}
