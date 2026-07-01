#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

function stable(value) {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + stable(value[k])).join(",") + "}";
  }
  return JSON.stringify(value);
}

function sha256Object(value) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

const standard = JSON.parse(readFileSync("STACK_GREEN_LEDGER/INVOCORDER_STACK_GREEN_LEDGER_STANDARD.json", "utf8"));
const receipt = JSON.parse(readFileSync("STACK_GREEN_LEDGER/INVOCORDER_STACK_GREEN_LEDGER_RECEIPT.json", "utf8"));

const failures = [];
const expectedHash = sha256Object(standard);

if (receipt.schema !== "invocorder.stack_green_ledger.receipt.v1") failures.push("receipt schema mismatch");
if (receipt.status !== "STACK_GREEN_LEDGER_VERIFIED") failures.push("receipt status mismatch");
if (receipt.owner_repo !== standard.owner_repo) failures.push("owner repo mismatch");
if (receipt.standard_hash !== expectedHash) failures.push("standard hash mismatch");

const expected = standard.required_pull_requests || [];
const observed = receipt.observed_stack || [];

if (observed.length !== expected.length) failures.push("observed stack count mismatch");
if (receipt.green_pull_request_count !== expected.length) failures.push("green pull request count mismatch");

for (let i = 0; i < expected.length; i++) {
  const exp = expected[i];
  const item = observed[i];
  if (!item) {
    failures.push(`missing observed item ${i}`);
    continue;
  }

  const live = item.observed || {};
  if (item.expected?.number !== exp.number) failures.push(`PR ${exp.number} expected number mismatch`);
  if (live.number !== exp.number) failures.push(`PR ${exp.number} observed number mismatch`);
  if (live.title !== exp.title) failures.push(`PR ${exp.number} title mismatch`);
  if (live.base !== exp.base) failures.push(`PR ${exp.number} base mismatch`);
  if (live.head !== exp.head) failures.push(`PR ${exp.number} head mismatch`);
  if (live.state !== "OPEN") failures.push(`PR ${exp.number} not open`);
  if (!Array.isArray(live.review_requests) || !live.review_requests.includes("verifrax-systems")) failures.push(`PR ${exp.number} reviewer request missing`);
  if ((live.checks_total || 0) < 1) failures.push(`PR ${exp.number} checks missing`);
  if ((live.checks_pending || 0) !== 0) failures.push(`PR ${exp.number} pending checks`);
  if ((live.checks_failing || 0) !== 0) failures.push(`PR ${exp.number} failing checks`);
  if (live.checks_successful !== live.checks_total) failures.push(`PR ${exp.number} checks not all successful`);
}

const summary = {
  schema: "invocorder.stack_green_ledger.verification.v1",
  status: failures.length === 0 ? "STACK_GREEN_LEDGER_VERIFIED" : "STACK_GREEN_LEDGER_FAILED",
  owner_repo: standard.owner_repo,
  standard_hash: expectedHash,
  green_pull_request_count: expected.length,
  failures_count: failures.length,
  failures
};

console.log(JSON.stringify(summary, null, 2));

if (failures.length) process.exit(1);

console.log("INVOCORDER_STACK_GREEN_LEDGER_VERIFY_PASS=true");
console.log(`GREEN_PULL_REQUEST_COUNT=${expected.length}`);
console.log("STACK_GREEN_LEDGER_NOT_TRUTH=true");
