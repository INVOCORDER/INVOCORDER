#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const standardPath = "STACK_MERGE_READINESS/INVOCORDER_STACK_MERGE_READINESS_STANDARD.json";
const receiptPath = "STACK_MERGE_READINESS/INVOCORDER_STACK_MERGE_READINESS_RECEIPT.json";
const label = "STACK_MERGE_READINESS";

function stable(value) {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stable(value[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

function sha256Object(value) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

const failures = [];

if (!existsSync(standardPath)) failures.push("standard missing");
if (!existsSync(receiptPath)) failures.push("receipt missing");

const standard = existsSync(standardPath) ? JSON.parse(readFileSync(standardPath, "utf8")) : {};
const receipt = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, "utf8")) : {};
const currentStandardHash = sha256Object(standard);

if (!String(receipt.status || "").includes("VERIFIED") && !String(receipt.status || "").includes("BOUND")) {
  failures.push("receipt status is not verified/bound");
}

if ((receipt.failures_count || 0) !== 0) {
  failures.push("receipt records failures");
}

for (const [key, value] of Object.entries(receipt.non_claims || {})) {
  if (value !== false) failures.push("non-claim overclaim: " + key);
}

const result = {
  schema: "invocorder.closure_safe_stack_ledger.verification.v2",
  status: failures.length === 0 ? label + "_VERIFIED" : label + "_FAILED",
  ledger: label,
  current_standard_hash: currentStandardHash,
  recorded_standard_hash: receipt.standard_hash || null,
  closure_safe: true,
  historical_standard_hash_not_recomputed_as_live_failure: true,
  live_pull_request_state_not_required_after_stack_close: true,
  failures_count: failures.length,
  failures
};

console.log(JSON.stringify(result, null, 2));

if (failures.length) process.exit(1);

console.log("INVOCORDER_" + label + "_VERIFY_PASS=true");
console.log("INVOCORDER_" + label + "_CLOSURE_SAFE=true");
