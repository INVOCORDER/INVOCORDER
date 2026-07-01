#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const standardPath = "STACK_MERGE_READINESS/INVOCORDER_STACK_MERGE_READINESS_STANDARD.json";
const receiptPath = "STACK_MERGE_READINESS/INVOCORDER_STACK_MERGE_READINESS_RECEIPT.json";

const standardBytes = readFileSync(standardPath);
const standard = JSON.parse(standardBytes);
const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
const standardHash = createHash("sha256").update(standardBytes).digest("hex");

const failures = [];

if (standard.schema !== "invocorder.stack_merge_readiness.standard.v1") failures.push("standard schema mismatch");
if (receipt.schema !== "invocorder.stack_merge_readiness.receipt.v1") failures.push("receipt schema mismatch");
if (receipt.standard_hash !== standardHash) failures.push("standard hash mismatch");
if (receipt.status !== "STACK_MERGE_READINESS_VERIFIED") failures.push(`receipt status is ${receipt.status}`);
if (receipt.owner_repo !== standard.owner_repo) failures.push("owner repo mismatch");
if (receipt.stack_root !== standard.stack_root) failures.push("stack root mismatch");
if (receipt.stack_tip_before_this_branch !== standard.stack_tip_before_this_branch) failures.push("stack tip mismatch");

const observed = Array.isArray(receipt.observed_pull_requests) ? receipt.observed_pull_requests : [];
if (observed.length !== standard.stacked_pull_requests.length) failures.push("observed pull request count mismatch");

for (const expected of standard.stacked_pull_requests) {
  const item = observed.find((entry) => entry?.expected?.number === expected.number || entry?.live?.number === expected.number);
  if (!item) {
    failures.push(`PR ${expected.number}: missing observation`);
    continue;
  }

  const live = item.live || {};
  if (live.title !== expected.title) failures.push(`PR ${expected.number}: title mismatch`);
  if (live.base !== expected.base) failures.push(`PR ${expected.number}: base mismatch`);
  if (live.head !== expected.head) failures.push(`PR ${expected.number}: head mismatch`);
  if (live.state !== standard.required_pull_request_state) failures.push(`PR ${expected.number}: state mismatch`);
  if (!Array.isArray(live.review_requests) || !live.review_requests.includes(standard.required_reviewer_request)) {
    failures.push(`PR ${expected.number}: reviewer request missing`);
  }
  if ((live.checks_total || 0) < standard.required_checks.successful_minimum) failures.push(`PR ${expected.number}: no successful check surface`);
  if (live.checks_pending !== 0) failures.push(`PR ${expected.number}: pending checks`);
  if (live.checks_failing !== 0) failures.push(`PR ${expected.number}: failing checks`);
}

for (const [key, value] of Object.entries(receipt.non_claims || {})) {
  if (value !== false) failures.push(`non-claim ${key} is not false`);
}

const result = {
  schema: "invocorder.stack_merge_readiness.verification.v1",
  status: failures.length === 0 ? "STACK_MERGE_READINESS_VERIFIED" : "STACK_MERGE_READINESS_FAILED",
  owner_repo: standard.owner_repo,
  standard_hash: standardHash,
  ready_pull_request_count: observed.length,
  failures_count: failures.length,
  failures
};

console.log(JSON.stringify(result, null, 2));

if (failures.length > 0) process.exit(1);

console.log("INVOCORDER_STACK_MERGE_READINESS_VERIFY_PASS=true");
console.log(`READY_PULL_REQUEST_COUNT=${observed.length}`);
console.log("STACK_MERGE_READINESS_NOT_TRUTH=true");
