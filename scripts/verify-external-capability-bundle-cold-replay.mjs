#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import child_process from "node:child_process";
import os from "node:os";
import path from "node:path";

const STANDARD_PATH = "CAPABILITY_BUNDLE_COLD_REPLAY/INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_COLD_REPLAY_STANDARD.json";
const RUNNER_PATH = "CAPABILITY_BUNDLE_COLD_REPLAY/INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_COLD_REPLAY_RUNNER.mjs";
const RECEIPT_PATH = "CAPABILITY_BUNDLE_COLD_REPLAY/INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_COLD_REPLAY_RECEIPT.json";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function stable(value) {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + stable(value[k])).join(",") + "}";
  }
  return JSON.stringify(value);
}

function sha256File(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function sha256CanonicalJson(obj) {
  return crypto.createHash("sha256").update(stable(obj)).digest("hex");
}

const standard = readJson(STANDARD_PATH);
const errors = [];

if (standard.object_type !== "INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_COLD_REPLAY_STANDARD") errors.push("bad standard object_type");
if (standard.schema_version !== "1.8.0") errors.push("bad standard schema_version");
if (standard.jurisdiction !== "INVOCORDER") errors.push("bad jurisdiction");

const policy = standard.cold_replay_policy || {};
for (const k of [
  "must_execute_from_fresh_temporary_directory",
  "must_not_read_local_repository_files",
  "must_download_v1_7_bundle_index_release_assets",
  "must_verify_v1_7_bundle_index_receipt_validity",
  "must_verify_v1_7_bundle_index_asset_hashes",
  "must_verify_v1_2_to_v1_6_chain_discoverable",
  "must_verify_chain_order_explicit",
  "must_verify_public_release_assets_only",
  "must_verify_private_source_not_required",
  "must_verify_local_working_tree_not_required",
  "must_preserve_non_claim_boundary"
]) {
  if (policy[k] !== true) errors.push(`policy not true: ${k}`);
}

for (const [k, v] of Object.entries(standard.required_non_claim_boundary || {})) {
  if (v !== false) errors.push(`non-claim ${k} must be false`);
}

const tempRun = fs.mkdtempSync(path.join(os.tmpdir(), "invocorder-v180-bundle-runner-exec-"));
const runnerCopy = path.join(tempRun, "INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_COLD_REPLAY_RUNNER.mjs");
fs.copyFileSync(RUNNER_PATH, runnerCopy);

let runnerOutput = "";
let runnerResult = null;

try {
  runnerOutput = child_process.execFileSync(process.execPath, [runnerCopy], {
    cwd: tempRun,
    encoding: "utf8",
    env: {
      ...process.env,
      GH_TOKEN: process.env.GH_TOKEN || "",
      GITHUB_TOKEN: process.env.GITHUB_TOKEN || ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const start = runnerOutput.indexOf("{");
  const end = runnerOutput.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("runner did not emit JSON");
  runnerResult = JSON.parse(runnerOutput.slice(start, end + 1));
} catch (e) {
  errors.push(`runner failed: ${String(e.message || e)}`);
}

if (runnerResult) {
  if (runnerResult.object_type !== "INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_COLD_REPLAY_RESULT") errors.push("bad runner result object_type");
  if (runnerResult.schema_version !== "1.8.0") errors.push("bad runner result schema_version");
  if (runnerResult.valid !== true) errors.push(`runner result invalid: ${JSON.stringify(runnerResult.errors || [])}`);
  if (runnerResult.local_repository_files_required !== false) errors.push("runner required local repository files");
  if (runnerResult.private_source_required !== false) errors.push("runner required private source");
  if ((runnerResult.local_repository_markers_seen_in_execution_directory || []).length !== 0) errors.push("runner execution directory contained repo markers");
  if (runnerResult.proves_v1_2_to_v1_6_capability_chain_discoverable_from_public_index !== true) errors.push("runner did not prove v1.2-v1.6 discoverability");
  if (runnerResult.proves_chain_order_explicit !== true) errors.push("runner did not prove explicit chain order");
  if (runnerResult.proves_private_source_not_required !== true) errors.push("runner did not prove private source not required");
  if (runnerResult.proves_local_working_tree_not_required !== true) errors.push("runner did not prove local working tree not required");

  for (const field of ["proves_truth", "proves_authorization", "proves_safety", "proves_admissibility", "proves_external_reality"]) {
    if (runnerResult[field] !== false) errors.push(`runner ${field} must be false`);
  }
}

const receipt = {
  object_type: "INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_COLD_REPLAY_RECEIPT",
  schema_version: "1.8.0",
  jurisdiction: "INVOCORDER",
  valid: errors.length === 0,
  errors,
  standard_path: STANDARD_PATH,
  standard_sha256_canonical_json: sha256CanonicalJson(standard),
  runner_path: RUNNER_PATH,
  runner_sha256: sha256File(RUNNER_PATH),
  runner_execution_directory: tempRun,
  runner_result: runnerResult,
  source_repository: "INVOCORDER/INVOCORDER",
  package_name: "@invocorder/recorder",
  package_version: "1.8.0",
  local_working_tree_required_for_bundle_cold_replay: false,
  private_source_required: false,
  public_release_asset_download_required: true,
  proves_external_capability_bundle_cold_replay: errors.length === 0,
  proves_standalone_runner_executed_from_fresh_temp_directory: !!runnerResult && (runnerResult.local_repository_markers_seen_in_execution_directory || []).length === 0,
  proves_v1_7_bundle_index_release_consumed: runnerResult?.proves_v1_7_bundle_index_release_consumed === true,
  proves_v1_2_to_v1_6_capability_chain_discoverable_from_public_index: runnerResult?.proves_v1_2_to_v1_6_capability_chain_discoverable_from_public_index === true,
  proves_chain_order_explicit: runnerResult?.proves_chain_order_explicit === true,
  proves_private_source_not_required: runnerResult?.proves_private_source_not_required === true,
  proves_local_working_tree_not_required: runnerResult?.proves_local_working_tree_not_required === true,
  proves_non_claim_boundary_preserved: errors.length === 0,
  proves_truth: false,
  proves_authorization: false,
  proves_safety: false,
  proves_admissibility: false,
  proves_external_reality: false
};

fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify(receipt, null, 2));
if (!receipt.valid) process.exit(1);
