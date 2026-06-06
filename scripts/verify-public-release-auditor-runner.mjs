#!/usr/bin/env node
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonicalize(value[k])]));
  }
  return value;
}
function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
function sha256File(file) {
  return sha256(fs.readFileSync(file));
}
function sha256CanonicalJsonFile(file) {
  return sha256(Buffer.from(JSON.stringify(canonicalize(JSON.parse(fs.readFileSync(file, "utf8"))))));
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function requireEqual(actual, expected, label, errors) {
  if (actual !== expected) errors.push(`${label}: expected ${expected}; got ${actual}`);
}

const errors = [];
const runnerPath = "AUDIT/INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER.mjs";
const standardPath = "AUDIT/PUBLIC_RELEASE_AUDITOR_RUNNER_STANDARD.json";
const receiptPath = "AUDIT/INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_RECEIPT.json";

try {
  if (!fs.existsSync(runnerPath)) errors.push(`missing runner: ${runnerPath}`);
  if (!fs.existsSync(standardPath)) errors.push(`missing standard: ${standardPath}`);

  const standard = readJson(standardPath);
  requireEqual(standard.object_type, "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_STANDARD", "standard object_type", errors);
  requireEqual(standard.schema_version, "0.8.0", "standard schema_version", errors);
  requireEqual(standard.source_release_tag, "v0.7.0-public-hostile-execution-release-consumption", "source release tag", errors);
  requireEqual(standard.local_working_tree_required_for_auditor, false, "standard local working tree requirement", errors);
  requireEqual(standard.private_source_required, false, "standard private source requirement", errors);

  const run = spawnSync(process.execPath, [runnerPath], {
    encoding: "utf8",
    env: {
      ...process.env,
      INVOCORDER_PUBLIC_AUDITOR_RECEIPT_PATH: receiptPath
    }
  });

  if (run.stdout) process.stdout.write(run.stdout);
  if (run.stderr) process.stderr.write(run.stderr);

  let runnerReceipt = null;
  if (!fs.existsSync(receiptPath)) {
    errors.push("runner did not write receipt");
  } else {
    runnerReceipt = readJson(receiptPath);
    requireEqual(runnerReceipt.object_type, "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_RECEIPT", "runner receipt object_type", errors);
    requireEqual(runnerReceipt.schema_version, "0.8.0", "runner receipt schema_version", errors);
    requireEqual(runnerReceipt.valid, true, "runner receipt valid", errors);
    requireEqual(runnerReceipt.downloaded_receipt_object_type, "INVOCORDER_PUBLIC_HOSTILE_EXECUTION_RELEASE_CONSUMPTION_RECEIPT", "downloaded receipt object_type", errors);
    requireEqual(runnerReceipt.downloaded_receipt_schema_version, "0.7.0", "downloaded receipt schema_version", errors);
    requireEqual(runnerReceipt.downloaded_receipt_valid, true, "downloaded receipt valid", errors);
    requireEqual(runnerReceipt.mcp_fixture_case_count, 10, "mcp fixture case count", errors);
    requireEqual(runnerReceipt.signed_bundle_fixture_case_count, 4, "signed bundle fixture case count", errors);
    requireEqual(runnerReceipt.mcp_passed_count, 10, "mcp passed count", errors);
    requireEqual(runnerReceipt.signed_bundle_passed_count, 4, "signed bundle passed count", errors);
    requireEqual(runnerReceipt.local_working_tree_required_for_auditor, false, "local working tree required for auditor", errors);
    requireEqual(runnerReceipt.local_sibling_fixture_repo_required, false, "local sibling fixture repo required", errors);
    requireEqual(runnerReceipt.private_source_required, false, "private source required", errors);
    requireEqual(runnerReceipt.proves_truth, false, "proves_truth", errors);
    requireEqual(runnerReceipt.proves_authorization, false, "proves_authorization", errors);
    requireEqual(runnerReceipt.proves_safety, false, "proves_safety", errors);
    requireEqual(runnerReceipt.proves_admissibility, false, "proves_admissibility", errors);
    requireEqual(runnerReceipt.proves_external_reality, false, "proves_external_reality", errors);
  }

  if (run.status !== 0 && runnerReceipt && runnerReceipt.valid) {
    errors.push(`runner exited nonzero despite valid receipt: ${run.status}`);
  }
} catch (e) {
  errors.push(e.message);
}

const valid = errors.length === 0;

const result = {
  object_type: "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_VERIFICATION_RESULT",
  schema_version: "0.8.0",
  valid,
  errors,
  runner_path: runnerPath,
  runner_sha256: fs.existsSync(runnerPath) ? sha256File(runnerPath) : null,
  standard_path: standardPath,
  standard_sha256_canonical_json: fs.existsSync(standardPath) ? sha256CanonicalJsonFile(standardPath) : null,
  receipt_path: receiptPath,
  receipt_sha256_canonical_json: fs.existsSync(receiptPath) ? sha256CanonicalJsonFile(receiptPath) : null,
  source_release_tag: "v0.7.0-public-hostile-execution-release-consumption",
  proves_standalone_public_release_auditor_runner: valid,
  proves_v0_7_public_release_assets_consumed: valid,
  proves_v0_7_release_asset_hashes_verified: valid,
  proves_public_execution_receipt_valid: valid,
  proves_local_working_tree_not_required_for_auditor: valid,
  proves_private_source_not_required: valid,
  proves_non_claim_boundary_preserved: valid,
  proves_truth: false,
  proves_authorization: false,
  proves_safety: false,
  proves_admissibility: false,
  proves_external_reality: false
};

console.log(JSON.stringify(result, null, 2));
if (!valid) process.exit(1);
