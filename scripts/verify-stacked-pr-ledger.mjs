#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const standardPath = "STACKED_PR_LEDGER/INVOCORDER_STACKED_PR_LEDGER_STANDARD.json";
const receiptPath = "STACKED_PR_LEDGER/INVOCORDER_STACKED_PR_LEDGER_RECEIPT.json";

const standardText = readFileSync(standardPath, "utf8");
const standard = JSON.parse(standardText);
const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
const standardHash = createHash("sha256").update(standardText).digest("hex");

const failures = [];

if (standard.schema !== "invocorder.stacked_pr_ledger.standard.v1") failures.push("invalid standard schema");
if (receipt.schema !== "invocorder.stacked_pr_ledger.receipt.v1") failures.push("invalid receipt schema");
if (receipt.standard_hash !== standardHash) failures.push("standard hash mismatch");
if (receipt.owner_repo !== standard.owner_repo) failures.push("owner repo mismatch");
if (receipt.failures_count !== 0) failures.push("receipt contains failures");
if (!Array.isArray(receipt.stacked_pull_requests)) failures.push("missing stacked pull requests");

for (const [key, value] of Object.entries(standard.non_claims || {})) {
  if (value !== false) failures.push(`standard non-claim overclaim: ${key}`);
}
for (const [key, value] of Object.entries(receipt.non_claims || {})) {
  if (value !== false) failures.push(`receipt non-claim overclaim: ${key}`);
}

const expected = standard.expected_pull_requests || [];
const actual = receipt.stacked_pull_requests || [];

if (actual.length !== expected.length) failures.push("stack length mismatch");

for (let i = 0; i < expected.length; i++) {
  const exp = expected[i];
  const row = actual[i];
  if (!row) continue;
  if (row.expected?.number !== exp.number) failures.push(`PR ${exp.number}: expected number mismatch`);
  if (row.live?.number !== exp.number) failures.push(`PR ${exp.number}: live number mismatch`);
  if (row.live?.base !== exp.base) failures.push(`PR ${exp.number}: base mismatch`);
  if (row.live?.head !== exp.head) failures.push(`PR ${exp.number}: head mismatch`);
  if (row.live?.state !== "OPEN") failures.push(`PR ${exp.number}: not open`);
  if ((row.live?.checks_total || 0) < 1) failures.push(`PR ${exp.number}: no checks`);
  if ((row.live?.checks_pending || 0) !== 0) failures.push(`PR ${exp.number}: pending checks`);
  if ((row.live?.checks_failing || 0) !== 0) failures.push(`PR ${exp.number}: failing checks`);
  if (!(row.live?.review_requests || []).includes("verifrax-systems")) failures.push(`PR ${exp.number}: missing reviewer request`);
}

const report = {
  schema: "invocorder.stacked_pr_ledger.verification.v1",
  status: failures.length === 0 ? "STACKED_PR_LEDGER_VERIFIED" : "STACKED_PR_LEDGER_FAILED",
  owner_repo: standard.owner_repo,
  standard_hash: standardHash,
  inspected_pull_request_count: actual.length,
  failures_count: failures.length,
  failures
};

console.log(JSON.stringify(report, null, 2));

if (failures.length) process.exit(1);

console.log("INVOCORDER_STACKED_PR_LEDGER_VERIFY_PASS=true");
console.log(`STACKED_PR_COUNT=${actual.length}`);
console.log("STACKED_PR_LEDGER_NOT_TRUTH=true");
