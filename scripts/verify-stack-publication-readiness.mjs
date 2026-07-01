#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

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

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const standard = JSON.parse(readFileSync("STACK_PUBLICATION_READINESS/INVOCORDER_STACK_PUBLICATION_READINESS_STANDARD.json", "utf8"));
const receipt = JSON.parse(readFileSync("STACK_PUBLICATION_READINESS/INVOCORDER_STACK_PUBLICATION_READINESS_RECEIPT.json", "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

const failures = [];
const standardHash = sha256Object(standard);

if (standard.schema !== "invocorder.stack_publication_readiness.standard.v1") failures.push("standard schema mismatch");
if (receipt.schema !== "invocorder.stack_publication_readiness.receipt.v1") failures.push("receipt schema mismatch");
if (receipt.status !== "STACK_PUBLICATION_READINESS_VERIFIED") failures.push(`receipt status mismatch: ${receipt.status}`);
if (receipt.standard_hash !== standardHash) failures.push("standard hash mismatch");
if (receipt.owner_repo !== standard.owner_repo) failures.push("owner repo mismatch");
if (receipt.package_name !== standard.package_name) failures.push("receipt package name mismatch");
if (receipt.package_version !== standard.package_version) failures.push("receipt package version mismatch");
if (pkg.name !== standard.package_name) failures.push("package name mismatch");
if (pkg.version !== standard.package_version) failures.push("package version mismatch");
if (pkg.private !== false) failures.push("package private is not false");
if (receipt.failures_count !== 0) failures.push("receipt contains failures");

const packageFiles = Array.isArray(pkg.files) ? pkg.files : [];
for (const surface of standard.required_package_surfaces || []) {
  if (!packageFiles.includes(surface)) failures.push(`package files missing surface: ${surface}`);
}

for (const file of standard.required_files || []) {
  if (!existsSync(file)) {
    failures.push(`required file missing: ${file}`);
    continue;
  }

  const recordedHash = receipt.observed_file_hashes?.[file];
  const actualHash = sha256File(file);
  if (recordedHash !== actualHash) failures.push(`file hash mismatch: ${file}`);
}

const expectedPullRequests = Array.isArray(standard.required_pull_requests) ? standard.required_pull_requests : [];
const observedPullRequests = Array.isArray(receipt.observed_pull_requests) ? receipt.observed_pull_requests : [];

if (observedPullRequests.length !== expectedPullRequests.length) failures.push("observed pull request count mismatch");

for (let index = 0; index < expectedPullRequests.length; index++) {
  const expected = expectedPullRequests[index];
  const row = observedPullRequests[index];

  if (!row) {
    failures.push(`PR ${expected.number}: missing observation`);
    continue;
  }

  const live = row.observed || {};
  if (row.expected?.number !== expected.number) failures.push(`PR ${expected.number}: expected number mismatch`);
  if (live.number !== expected.number) failures.push(`PR ${expected.number}: live number mismatch`);
  if (live.title !== expected.title) failures.push(`PR ${expected.number}: title mismatch`);
  if (live.base !== expected.base) failures.push(`PR ${expected.number}: base mismatch`);
  if (live.head !== expected.head) failures.push(`PR ${expected.number}: head mismatch`);
  if (live.state !== "OPEN") failures.push(`PR ${expected.number}: not open`);
  if (!Array.isArray(live.review_requests) || !live.review_requests.includes("verifrax-systems")) failures.push(`PR ${expected.number}: reviewer request missing`);
  if ((live.checks_total || 0) < 1) failures.push(`PR ${expected.number}: no checks`);
  if (live.checks_pending !== 0) failures.push(`PR ${expected.number}: pending checks`);
  if (live.checks_failing !== 0) failures.push(`PR ${expected.number}: failing checks`);
  if (live.checks_successful !== live.checks_total) failures.push(`PR ${expected.number}: checks not all successful`);

  if (index > 0 && live.base !== expectedPullRequests[index - 1].head) {
    failures.push(`PR ${expected.number}: stack chain mismatch`);
  }
}

for (const [key, value] of Object.entries(receipt.non_claims || {})) {
  if (value !== false) failures.push(`non-claim overclaim: ${key}`);
}

const result = {
  schema: "invocorder.stack_publication_readiness.verification.v1",
  status: failures.length === 0 ? "STACK_PUBLICATION_READINESS_VERIFIED" : "STACK_PUBLICATION_READINESS_FAILED",
  owner_repo: standard.owner_repo,
  standard_hash: standardHash,
  publication_readiness_pull_request_count: expectedPullRequests.length,
  publication_readiness_file_count: (standard.required_files || []).length,
  failures_count: failures.length,
  failures
};

console.log(JSON.stringify(result, null, 2));

if (failures.length) process.exit(1);

console.log("INVOCORDER_STACK_PUBLICATION_READINESS_VERIFY_PASS=true");
console.log(`PUBLICATION_READINESS_PULL_REQUEST_COUNT=${expectedPullRequests.length}`);
console.log("STACK_PUBLICATION_READINESS_NOT_PUBLICATION=true");
console.log("STACK_PUBLICATION_READINESS_NOT_RELEASE=true");
console.log("STACK_PUBLICATION_READINESS_NOT_TRUTH=true");
