#!/usr/bin/env node
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

"use strict";

const fs = require("node:fs");
const https = require("node:https");
const crypto = require("node:crypto");
const path = require("node:path");

const EXPECTED = {
  "object_type": "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_STANDARD",
  "schema_version": "0.8.0",
  "jurisdiction": "INVOCORDER",
  "source_repository": "INVOCORDER/INVOCORDER",
  "source_release_tag": "v0.7.0-public-hostile-execution-release-consumption",
  "source_release_url": "https://github.com/INVOCORDER/INVOCORDER/releases/tag/v0.7.0-public-hostile-execution-release-consumption",
  "required_public_release_assets": [
    {
      "name": "PUBLIC_HOSTILE_EXECUTION_RELEASE_CONSUMPTION_STANDARD.json",
      "expected_sha256": "64602b2e6ae6754a80180aee109f646bb047ba62e43f912df9aa097f9d496816",
      "expected_sha256_canonical_json": "286896fc757dafbc5b64c2e24ab65b5203152da421e4e2d5775fa45e7c3fc359"
    },
    {
      "name": "INVOCORDER_PUBLIC_HOSTILE_EXECUTION_RELEASE_CONSUMPTION_RECEIPT.json",
      "expected_sha256": "085ef6de6bbfb9d336986caa344341ab961717d6e8954c98754c39ac2b596c74",
      "expected_sha256_canonical_json": "31b3b10a9d6f4bbcef177e83b8350f9aaf42655b9520370e49d65af06c2baa90"
    }
  ],
  "expected_receipt_object_type": "INVOCORDER_PUBLIC_HOSTILE_EXECUTION_RELEASE_CONSUMPTION_RECEIPT",
  "expected_receipt_schema_version": "0.7.0",
  "expected_mcp_fixture_case_count": 10,
  "expected_signed_bundle_fixture_case_count": 4,
  "expected_mcp_passed_count": 10,
  "expected_signed_bundle_passed_count": 4,
  "local_working_tree_required_for_auditor": false,
  "local_sibling_fixture_repo_required": false,
  "private_source_required": false,
  "proves_truth": false,
  "proves_authorization": false,
  "proves_safety": false,
  "proves_admissibility": false,
  "proves_external_reality": false
};

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonicalize(value[k])]));
  }
  return value;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sha256CanonicalJson(value) {
  return sha256(Buffer.from(JSON.stringify(canonicalize(value))));
}

function requestBuffer(url, headers = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "INVOCORDER-public-release-auditor-runner/0.8.0",
        "Accept": "application/vnd.github+json",
        ...(process.env.GH_TOKEN ? { "Authorization": `Bearer ${process.env.GH_TOKEN}` } : {}),
        ...headers
      }
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        if (redirects > 8) return reject(new Error("too many redirects"));
        return resolve(requestBuffer(res.headers.location, headers, redirects + 1));
      }
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        const body = Buffer.concat(chunks);
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`GET ${url} failed: HTTP ${res.statusCode}: ${body.toString("utf8").slice(0, 300)}`));
        }
        resolve(body);
      });
    });
    req.on("error", reject);
  });
}

async function requestJson(url) {
  return JSON.parse((await requestBuffer(url)).toString("utf8"));
}

function equal(actual, expected, label, errors) {
  if (actual !== expected) {
    errors.push(`${label}: expected ${expected}; got ${actual}`);
  }
}

async function main() {
  const errors = [];
  let release = null;
  const consumed = [];

  try {
    const apiUrl = `https://api.github.com/repos/${EXPECTED.source_repository}/releases/tags/${EXPECTED.source_release_tag}`;
    release = await requestJson(apiUrl);

    for (const expectedAsset of EXPECTED.required_public_release_assets) {
      const asset = (release.assets || []).find(a => a.name === expectedAsset.name);
      if (!asset) {
        errors.push(`missing release asset: ${expectedAsset.name}`);
        continue;
      }

      const bytes = await requestBuffer(asset.browser_download_url, { "Accept": "application/octet-stream" });
      const rawSha = sha256(bytes);
      equal(rawSha, expectedAsset.expected_sha256, `${expectedAsset.name} sha256`, errors);

      let parsed = null;
      let canonicalSha = null;
      try {
        parsed = JSON.parse(bytes.toString("utf8"));
        canonicalSha = sha256CanonicalJson(parsed);
        equal(canonicalSha, expectedAsset.expected_sha256_canonical_json, `${expectedAsset.name} canonical sha256`, errors);
      } catch (e) {
        errors.push(`${expectedAsset.name} JSON parse failed: ${e.message}`);
      }

      consumed.push({
        name: asset.name,
        size_bytes: bytes.length,
        sha256: rawSha,
        sha256_canonical_json: canonicalSha,
        expected_sha256: expectedAsset.expected_sha256,
        expected_sha256_canonical_json: expectedAsset.expected_sha256_canonical_json,
        browser_download_url: asset.browser_download_url,
        parsed
      });
    }
  } catch (e) {
    errors.push(e.message);
  }

  const receiptAsset = consumed.find(a => a.name === "INVOCORDER_PUBLIC_HOSTILE_EXECUTION_RELEASE_CONSUMPTION_RECEIPT.json");
  const receipt = receiptAsset && receiptAsset.parsed ? receiptAsset.parsed : null;

  if (!receipt) {
    errors.push("v0.7 receipt asset was not parsed");
  } else {
    equal(receipt.object_type, EXPECTED.expected_receipt_object_type, "downloaded receipt object_type", errors);
    equal(receipt.schema_version, EXPECTED.expected_receipt_schema_version, "downloaded receipt schema_version", errors);
    equal(receipt.valid, true, "downloaded receipt valid", errors);
    equal(receipt.mcp_fixture_case_count, EXPECTED.expected_mcp_fixture_case_count, "mcp fixture case count", errors);
    equal(receipt.signed_bundle_fixture_case_count, EXPECTED.expected_signed_bundle_fixture_case_count, "signed bundle fixture case count", errors);
    equal(receipt.mcp_passed_count, EXPECTED.expected_mcp_passed_count, "mcp passed count", errors);
    equal(receipt.signed_bundle_passed_count, EXPECTED.expected_signed_bundle_passed_count, "signed bundle passed count", errors);
    equal(receipt.local_working_tree_required_for_source_receipt, false, "local working tree required for source receipt", errors);
    equal(receipt.local_sibling_fixture_repo_required, false, "local sibling fixture repo required", errors);
    equal(receipt.private_source_required, false, "private source required", errors);
    equal(receipt.proves_truth, false, "proves_truth", errors);
    equal(receipt.proves_authorization, false, "proves_authorization", errors);
    equal(receipt.proves_safety, false, "proves_safety", errors);
    equal(receipt.proves_admissibility, false, "proves_admissibility", errors);
    equal(receipt.proves_external_reality, false, "proves_external_reality", errors);
  }

  const valid = errors.length === 0;

  const output = {
    object_type: "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_RECEIPT",
    schema_version: "0.8.0",
    jurisdiction: "INVOCORDER",
    valid,
    errors,
    source_repository: EXPECTED.source_repository,
    source_release_tag: EXPECTED.source_release_tag,
    source_release_url: EXPECTED.source_release_url,
    source_release_html_url: release ? release.html_url : null,
    consumed_public_release_assets: consumed.map(({ parsed, ...rest }) => rest),
    downloaded_receipt_object_type: receipt ? receipt.object_type : null,
    downloaded_receipt_schema_version: receipt ? receipt.schema_version : null,
    downloaded_receipt_valid: receipt ? receipt.valid : null,
    mcp_fixture_case_count: receipt ? receipt.mcp_fixture_case_count : null,
    signed_bundle_fixture_case_count: receipt ? receipt.signed_bundle_fixture_case_count : null,
    mcp_passed_count: receipt ? receipt.mcp_passed_count : null,
    signed_bundle_passed_count: receipt ? receipt.signed_bundle_passed_count : null,
    local_working_tree_required_for_auditor: false,
    local_sibling_fixture_repo_required: false,
    private_source_required: false,
    public_release_asset_download_required: true,
    proves_standalone_public_release_auditor_runner: valid,
    proves_v0_7_public_release_assets_consumed: valid,
    proves_v0_7_release_asset_hashes_verified: valid,
    proves_public_execution_receipt_valid: valid,
    proves_fixture_expected_outputs_preserved: valid,
    proves_non_claim_boundary_preserved: valid,
    proves_truth: false,
    proves_authorization: false,
    proves_safety: false,
    proves_admissibility: false,
    proves_external_reality: false
  };

  if (process.env.INVOCORDER_PUBLIC_AUDITOR_RECEIPT_PATH) {
    fs.mkdirSync(path.dirname(process.env.INVOCORDER_PUBLIC_AUDITOR_RECEIPT_PATH), { recursive: true });
    fs.writeFileSync(process.env.INVOCORDER_PUBLIC_AUDITOR_RECEIPT_PATH, JSON.stringify(output, null, 2) + "\n");
  }

  console.log(JSON.stringify(output, null, 2));
  if (!valid) process.exitCode = 1;
}

main().catch(e => {
  const output = {
    object_type: "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_RECEIPT",
    schema_version: "0.8.0",
    jurisdiction: "INVOCORDER",
    valid: false,
    errors: [e.message],
    proves_truth: false,
    proves_authorization: false,
    proves_safety: false,
    proves_admissibility: false,
    proves_external_reality: false
  };
  console.log(JSON.stringify(output, null, 2));
  process.exitCode = 1;
});
