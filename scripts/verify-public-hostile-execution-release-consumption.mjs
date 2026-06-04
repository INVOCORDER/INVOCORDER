#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const errors = [];

function fail(msg) {
  errors.push(msg);
}

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts
  }).trim();
}

function sha256Bytes(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function sha256CanonicalJson(obj) {
  return createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) fail(`${label}: expected ${expected}; got ${actual}`);
}

function requireFalse(value, label) {
  if (value !== false) fail(`${label} must be false`);
}

function ghJson(args) {
  return JSON.parse(run("gh", ["api", ...args]));
}

let result;

try {
  const pkg = readJson("package.json");
  const standard = readJson("RELEASE_CONSUMPTION/PUBLIC_HOSTILE_EXECUTION_RELEASE_CONSUMPTION_STANDARD.json");

  requireEqual(pkg.version, "0.7.0", "package version");
  requireEqual(standard.object_type, "INVOCORDER_PUBLIC_HOSTILE_EXECUTION_RELEASE_CONSUMPTION_STANDARD", "standard object_type");
  requireEqual(standard.schema_version, "0.7.0", "standard schema_version");

  for (const [key, expected] of Object.entries(standard.required_non_claims)) {
    requireFalse(expected, `standard.required_non_claims.${key}`);
  }

  const release = ghJson([
    `/repos/${standard.source_repository}/releases/tags/${standard.source_release_tag}`
  ]);

  requireEqual(release.draft, false, "source release draft");
  requireEqual(release.prerelease, false, "source release prerelease");
  requireEqual(release.tag_name, standard.source_release_tag, "source release tag");

  const tagRef = ghJson([
    `/repos/${standard.source_repository}/git/ref/tags/${standard.source_release_tag}`
  ]);

  const releaseAssetNames = new Set((release.assets || []).map(a => a.name));
  for (const requiredAsset of standard.required_public_release_assets) {
    if (!releaseAssetNames.has(requiredAsset)) fail(`missing public release asset: ${requiredAsset}`);
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "invocorder-v070-public-release-"));
  const consumed = [];

  for (const name of standard.required_public_release_assets) {
    const asset = release.assets.find(a => a.name === name);
    const out = path.join(tmp, name);

    run("gh", [
      "release",
      "download",
      standard.source_release_tag,
      "--repo",
      standard.source_repository,
      "--pattern",
      name,
      "--dir",
      tmp,
      "--clobber"
    ]);

    const bytes = fs.readFileSync(out);
    const parsed = JSON.parse(bytes.toString("utf8"));
    consumed.push({
      name,
      size_bytes: bytes.length,
      sha256: sha256Bytes(bytes),
      sha256_canonical_json: sha256CanonicalJson(parsed),
      browser_download_url: asset.browser_download_url
    });
  }

  const downloadedStandard = readJson(path.join(tmp, "PUBLIC_HOSTILE_FIXTURE_EXECUTION_STANDARD.json"));
  const downloadedReceipt = readJson(path.join(tmp, "INVOCORDER_PUBLIC_HOSTILE_FIXTURE_EXECUTION_RECEIPT.json"));

  requireEqual(downloadedStandard.object_type, standard.required_standard_object_type, "downloaded standard object_type");
  requireEqual(downloadedStandard.schema_version, standard.required_standard_schema_version, "downloaded standard schema_version");
  requireEqual(downloadedReceipt.object_type, standard.required_receipt_object_type, "downloaded receipt object_type");
  requireEqual(downloadedReceipt.schema_version, standard.required_receipt_schema_version, "downloaded receipt schema_version");
  requireEqual(downloadedReceipt.valid, true, "downloaded receipt valid");

  requireEqual(downloadedReceipt.mcp_fixture_case_count, standard.required_fixture_counts.mcp_fixture_case_count, "mcp fixture count");
  requireEqual(downloadedReceipt.signed_bundle_fixture_case_count, standard.required_fixture_counts.signed_bundle_fixture_case_count, "signed bundle fixture count");

  for (const r of downloadedReceipt.mcp_results || []) {
    requireEqual(r.passed, true, `MCP ${r.fixture} passed`);
  }

  for (const r of downloadedReceipt.signed_bundle_results || []) {
    requireEqual(r.passed, true, `signed bundle ${r.fixture} passed`);
  }

  for (const [key] of Object.entries(standard.required_non_claims)) {
    requireFalse(downloadedReceipt[key], `downloaded receipt.${key}`);
  }

  result = {
    object_type: "INVOCORDER_PUBLIC_HOSTILE_EXECUTION_RELEASE_CONSUMPTION_RECEIPT",
    schema_version: "0.7.0",
    jurisdiction: "INVOCORDER",
    valid: errors.length === 0,
    errors,
    source_release_tag: standard.source_release_tag,
    source_release_url: release.html_url,
    source_release_target_commitish: release.target_commitish,
    source_tag_ref_object_type: tagRef.object?.type || null,
    source_tag_ref_sha: tagRef.object?.sha || null,
    consumed_public_release_assets: consumed,
    downloaded_receipt_object_type: downloadedReceipt.object_type,
    downloaded_receipt_schema_version: downloadedReceipt.schema_version,
    downloaded_receipt_valid: downloadedReceipt.valid,
    mcp_fixture_case_count: downloadedReceipt.mcp_fixture_case_count,
    signed_bundle_fixture_case_count: downloadedReceipt.signed_bundle_fixture_case_count,
    mcp_passed_count: (downloadedReceipt.mcp_results || []).filter(r => r.passed === true).length,
    signed_bundle_passed_count: (downloadedReceipt.signed_bundle_results || []).filter(r => r.passed === true).length,
    public_release_asset_download_required: true,
    local_working_tree_required_for_source_receipt: false,
    local_sibling_fixture_repo_required: false,
    private_source_required: false,
    proves_public_hostile_execution_release_consumed: errors.length === 0,
    proves_public_release_assets_exist: errors.length === 0,
    proves_public_release_assets_parse: errors.length === 0,
    proves_public_execution_receipt_valid: errors.length === 0,
    proves_fixture_expected_outputs_preserved: errors.length === 0,
    proves_non_claim_boundary_preserved: errors.length === 0,
    proves_truth: false,
    proves_authorization: false,
    proves_safety: false,
    proves_admissibility: false,
    proves_external_reality: false
  };
} catch (e) {
  result = {
    object_type: "INVOCORDER_PUBLIC_HOSTILE_EXECUTION_RELEASE_CONSUMPTION_RECEIPT",
    schema_version: "0.7.0",
    jurisdiction: "INVOCORDER",
    valid: false,
    errors: [String(e?.message || e), ...errors],
    proves_public_hostile_execution_release_consumed: false,
    proves_public_release_assets_exist: false,
    proves_public_release_assets_parse: false,
    proves_public_execution_receipt_valid: false,
    proves_fixture_expected_outputs_preserved: false,
    proves_non_claim_boundary_preserved: false,
    proves_truth: false,
    proves_authorization: false,
    proves_safety: false,
    proves_admissibility: false,
    proves_external_reality: false
  };
}

fs.writeFileSync(
  "RELEASE_CONSUMPTION/INVOCORDER_PUBLIC_HOSTILE_EXECUTION_RELEASE_CONSUMPTION_RECEIPT.json",
  JSON.stringify(result, null, 2) + "\n"
);

console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exit(1);
