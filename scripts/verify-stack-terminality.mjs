#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const standardPath = "STACK_TERMINALITY/INVOCORDER_STACK_TERMINALITY_STANDARD.json";
const receiptPath = "STACK_TERMINALITY/INVOCORDER_STACK_TERMINALITY_RECEIPT.json";

const standardText = readFileSync(standardPath, "utf8");
const standard = JSON.parse(standardText);
const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
const standardHash = createHash("sha256").update(standardText).digest("hex");

const failures = [];

if (standard.schema !== "invocorder.stack_terminality.standard.v1") failures.push("invalid standard schema");
if (receipt.schema !== "invocorder.stack_terminality.receipt.v1") failures.push("invalid receipt schema");
if (receipt.standard_hash !== standardHash) failures.push("standard hash mismatch");
if (receipt.owner_repo !== standard.owner_repo) failures.push("owner repo mismatch");
if (receipt.chain_root !== standard.chain_root) failures.push("chain root mismatch");
if (receipt.chain_tip !== standard.chain_tip) failures.push("chain tip mismatch");
if (receipt.failures_count !== 0) failures.push("receipt contains failures");

for (const [key, value] of Object.entries(standard.non_claims || {})) {
  if (value !== false) failures.push(`standard non-claim overclaim: ${key}`);
}

for (const [key, value] of Object.entries(receipt.non_claims || {})) {
  if (value !== false) failures.push(`receipt non-claim overclaim: ${key}`);
}

const expected = standard.expected_chain || [];
const observed = receipt.observed_chain || [];

if (observed.length !== expected.length) failures.push("observed chain length mismatch");

for (let i = 0; i < expected.length; i++) {
  const exp = expected[i];
  const row = observed[i];

  if (!row) continue;

  if (row.expected?.number !== exp.number) failures.push(`PR ${exp.number}: expected number mismatch`);
  if (row.observed?.number !== exp.number) failures.push(`PR ${exp.number}: observed number mismatch`);
  if (row.observed?.title !== exp.title) failures.push(`PR ${exp.number}: title mismatch`);
  if (row.observed?.base !== exp.base) failures.push(`PR ${exp.number}: base mismatch`);
  if (row.observed?.head !== exp.head) failures.push(`PR ${exp.number}: head mismatch`);
  if (row.observed?.state !== "OPEN") failures.push(`PR ${exp.number}: not OPEN`);
  if (!(row.observed?.review_requests || []).includes("verifrax-systems")) failures.push(`PR ${exp.number}: reviewer request missing`);
  if ((row.observed?.checks_total || 0) < 1) failures.push(`PR ${exp.number}: no checks`);
  if ((row.observed?.checks_pending || 0) !== 0) failures.push(`PR ${exp.number}: pending checks`);
  if ((row.observed?.checks_failing || 0) !== 0) failures.push(`PR ${exp.number}: failing checks`);
  if (row.observed?.checks_successful !== row.observed?.checks_total) failures.push(`PR ${exp.number}: successful check count mismatch`);
}

for (let i = 1; i < observed.length; i++) {
  if (observed[i].observed?.base !== observed[i - 1].observed?.head) {
    failures.push(`PR ${observed[i].expected?.number}: stack linkage mismatch`);
  }
}

const report = {
  schema: "invocorder.stack_terminality.verification.v1",
  status: failures.length === 0 ? "STACK_TERMINALITY_VERIFIED" : "STACK_TERMINALITY_FAILED",
  owner_repo: standard.owner_repo,
  standard_hash: standardHash,
  terminal_pull_request_count: observed.length,
  failures_count: failures.length,
  failures
};

console.log(JSON.stringify(report, null, 2));

if (failures.length) process.exit(1);

console.log("INVOCORDER_STACK_TERMINALITY_VERIFY_PASS=true");
console.log(`TERMINAL_PULL_REQUEST_COUNT=${observed.length}`);
console.log("STACK_TERMINALITY_NOT_TRUTH=true");
