#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

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

const standard = JSON.parse(readFileSync("STACK_RELEASE_CANDIDATE/INVOCORDER_STACK_RELEASE_CANDIDATE_STANDARD.json", "utf8"));
const receipt = JSON.parse(readFileSync("STACK_RELEASE_CANDIDATE/INVOCORDER_STACK_RELEASE_CANDIDATE_RECEIPT.json", "utf8"));

const failures = [];
const expectedHash = sha256Object(standard);

if (standard.schema !== "invocorder.stack_release_candidate.standard.v1") failures.push("standard schema mismatch");
if (receipt.schema !== "invocorder.stack_release_candidate.receipt.v1") failures.push("receipt schema mismatch");
if (receipt.status !== "STACK_RELEASE_CANDIDATE_VERIFIED") failures.push(`receipt status mismatch: ${receipt.status}`);
if (receipt.owner_repo !== standard.owner_repo) failures.push("owner repo mismatch");
if (receipt.standard_hash !== expectedHash) failures.push("standard hash mismatch");
if (receipt.stack_root !== standard.stack_root) failures.push("stack root mismatch");
if (receipt.stack_tip_before_this_branch !== standard.stack_tip_before_this_branch) failures.push("stack tip mismatch");
if (receipt.failures_count !== 0) failures.push("receipt contains failures");

const expected = Array.isArray(standard.required_pull_requests) ? standard.required_pull_requests : [];
const observed = Array.isArray(receipt.observed_pull_requests) ? receipt.observed_pull_requests : [];

if (observed.length !== expected.length) failures.push("observed PR count mismatch");
if (receipt.release_candidate_pull_request_count !== expected.length) failures.push("release candidate PR count mismatch");

for (let index = 0; index < expected.length; index++) {
  const exp = expected[index];
  const item = observed[index];

  if (!item) {
    failures.push(`PR ${exp.number}: missing observation`);
    continue;
  }

  const live = item.observed || {};
  if (item.expected?.number !== exp.number) failures.push(`PR ${exp.number}: expected number mismatch`);
  if (live.number !== exp.number) failures.push(`PR ${exp.number}: observed number mismatch`);
  if (live.title !== exp.title) failures.push(`PR ${exp.number}: title mismatch`);
  if (live.base !== exp.base) failures.push(`PR ${exp.number}: base mismatch`);
  if (live.head !== exp.head) failures.push(`PR ${exp.number}: head mismatch`);
  if (live.state !== standard.required_observations.pull_request_state) failures.push(`PR ${exp.number}: state mismatch`);
  if (!Array.isArray(live.review_requests) || !live.review_requests.includes(standard.required_observations.required_reviewer_request)) failures.push(`PR ${exp.number}: reviewer request missing`);
  if ((live.checks_total || 0) < 1) failures.push(`PR ${exp.number}: checks missing`);
  if (live.checks_pending !== 0) failures.push(`PR ${exp.number}: pending checks`);
  if (live.checks_failing !== 0) failures.push(`PR ${exp.number}: failing checks`);
  if (live.checks_successful !== live.checks_total) failures.push(`PR ${exp.number}: checks not all successful`);

  if (index > 0 && live.base !== expected[index - 1].head) {
    failures.push(`PR ${exp.number}: base/head stack chain mismatch`);
  }
}

for (const [key, value] of Object.entries(receipt.non_claims || {})) {
  if (value !== false) failures.push(`receipt non-claim overclaim: ${key}`);
}

const result = {
  schema: "invocorder.stack_release_candidate.verification.v1",
  status: failures.length === 0 ? "STACK_RELEASE_CANDIDATE_VERIFIED" : "STACK_RELEASE_CANDIDATE_FAILED",
  owner_repo: standard.owner_repo,
  standard_hash: expectedHash,
  release_candidate_pull_request_count: expected.length,
  failures_count: failures.length,
  failures
};

console.log(JSON.stringify(result, null, 2));

if (failures.length) process.exit(1);

console.log("INVOCORDER_STACK_RELEASE_CANDIDATE_VERIFY_PASS=true");
console.log(`RELEASE_CANDIDATE_PULL_REQUEST_COUNT=${expected.length}`);
console.log("STACK_RELEASE_CANDIDATE_NOT_RELEASE=true");
console.log("STACK_RELEASE_CANDIDATE_NOT_TRUTH=true");
