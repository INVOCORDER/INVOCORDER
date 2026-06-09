#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import child_process from "node:child_process";
import os from "node:os";
import path from "node:path";

const STANDARD_PATH = "CAPABILITY_COLD_REPLAY/INVOCORDER_EXTERNAL_CAPABILITY_COLD_REPLAY_STANDARD.json";
const RUNNER_PATH = "CAPABILITY_COLD_REPLAY/INVOCORDER_EXTERNAL_CAPABILITY_COLD_REPLAY_RUNNER.mjs";
const RECEIPT_PATH = "CAPABILITY_COLD_REPLAY/INVOCORDER_EXTERNAL_CAPABILITY_COLD_REPLAY_RECEIPT.json";

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

function sha256Text(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function sha256File(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function sha256CanonicalJson(obj) {
  return sha256Text(stable(obj));
}

const errors = [];
const standard = readJson(STANDARD_PATH);

if (standard.object_type !== "INVOCORDER_EXTERNAL_CAPABILITY_COLD_REPLAY_STANDARD") errors.push("bad standard object_type");
if (standard.schema_version !== "1.6.0") errors.push("bad standard schema_version");
if (standard.jurisdiction !== "INVOCORDER") errors.push("bad jurisdiction");

const policy = standard.cold_replay_policy || {};
for (const k of [
  "must_execute_from_fresh_temporary_directory",
  "must_not_read_local_repository_files",
  "must_download_source_release_assets",
  "must_verify_source_asset_byte_hashes",
  "must_verify_source_asset_canonical_json_hashes",
  "must_verify_source_receipt_validity",
  "must_verify_external_release_consumption_policy",
  "must_verify_local_only_manifest_admission_blocked",
  "must_verify_release_asset_boundary_required",
  "must_preserve_non_claim_boundary"
]) {
  if (policy[k] !== true) errors.push(`policy not true: ${k}`);
}

for (const [k, v] of Object.entries(standard.required_non_claim_boundary || {})) {
  if (v !== false) errors.push(`non-claim ${k} must be false`);
}

const tempRun = fs.mkdtempSync(path.join(os.tmpdir(), "invocorder-v160-runner-exec-"));
const runnerCopy = path.join(tempRun, "INVOCORDER_EXTERNAL_CAPABILITY_COLD_REPLAY_RUNNER.mjs");
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
  if (runnerResult.object_type !== "INVOCORDER_EXTERNAL_CAPABILITY_COLD_REPLAY_RESULT") errors.push("bad runner result object_type");
  if (runnerResult.schema_version !== "1.6.0") errors.push("bad runner result schema_version");
  if (runnerResult.valid !== true) errors.push(`runner result invalid: ${JSON.stringify(runnerResult.errors || [])}`);
  if (runnerResult.local_repository_files_required !== false) errors.push("runner required local repository files");
  if (runnerResult.private_source_required !== false) errors.push("runner required private source");
  if (runnerResult.proves_truth !== false) errors.push("runner must not prove truth");
  if (runnerResult.proves_authorization !== false) errors.push("runner must not prove authorization");
  if (runnerResult.proves_safety !== false) errors.push("runner must not prove safety");
  if (runnerResult.proves_admissibility !== false) errors.push("runner must not prove admissibility");
  if (runnerResult.proves_external_reality !== false) errors.push("runner must not prove external reality");
  if ((runnerResult.local_repository_markers_seen_in_execution_directory || []).length !== 0) errors.push("runner execution directory contained repo markers");
}

const receipt = {
  object_type: "INVOCORDER_EXTERNAL_CAPABILITY_COLD_REPLAY_RECEIPT",
  schema_version: "1.6.0",
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
  package_version: "1.6.0",
  local_working_tree_required_for_cold_replay: false,
  private_source_required: false,
  public_release_asset_download_required: true,
  proves_external_capability_cold_replay: errors.length === 0,
  proves_standalone_runner_executed_from_fresh_temp_directory: !!runnerResult && (runnerResult.local_repository_markers_seen_in_execution_directory || []).length === 0,
  proves_v1_5_external_release_consumption_release_consumed: runnerResult?.proves_v1_5_external_release_consumption_release_consumed === true,
  proves_local_only_external_manifest_blocked: runnerResult?.proves_local_only_external_manifest_blocked === true,
  proves_release_asset_boundary_required: runnerResult?.proves_release_asset_boundary_required === true,
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
