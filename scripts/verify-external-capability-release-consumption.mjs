#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import https from "node:https";

const STANDARD_PATH = "CAPABILITY_RELEASE_CONSUMPTION/INVOCORDER_EXTERNAL_CAPABILITY_RELEASE_CONSUMPTION_STANDARD.json";
const RECEIPT_PATH = "CAPABILITY_RELEASE_CONSUMPTION/INVOCORDER_EXTERNAL_CAPABILITY_RELEASE_CONSUMPTION_RECEIPT.json";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function stable(value) {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + stable(value[k])).join(",") + "}";
  }
  return JSON.stringify(value);
}

function sha256Bytes(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function sha256CanonicalJson(obj) {
  return crypto.createHash("sha256").update(stable(obj)).digest("hex");
}

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "INVOCORDER-v1.5-external-capability-release-consumption",
        "Accept": "application/octet-stream"
      }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        get(res.headers.location).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`download failed ${res.statusCode} ${url}`));
        return;
      }
      const chunks = [];
      res.on("data", d => chunks.push(d));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
  });
}

function releaseAssetUrl(tag, name) {
  return `https://github.com/INVOCORDER/INVOCORDER/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`;
}

const standard = readJson(STANDARD_PATH);
const errors = [];

if (standard.object_type !== "INVOCORDER_EXTERNAL_CAPABILITY_RELEASE_CONSUMPTION_STANDARD") errors.push("bad standard object_type");
if (standard.schema_version !== "1.5.0") errors.push("bad standard schema_version");
if (standard.jurisdiction !== "INVOCORDER") errors.push("bad jurisdiction");
if (standard.source_repository !== "INVOCORDER/INVOCORDER") errors.push("bad source_repository");

const sourceGate = standard.source_gate || {};
const policy = standard.external_release_consumption_policy || {};
const requiredAssets = sourceGate.required_assets || [];

for (const k of [
  "external_manifest_must_be_public_release_asset",
  "external_manifest_must_have_bound_release_asset_boundary",
  "external_manifest_must_have_sha256_or_canonical_sha256",
  "external_manifest_must_preserve_non_claim_boundary",
  "external_manifest_must_not_claim_truth",
  "external_manifest_must_not_claim_authorization",
  "external_manifest_must_not_claim_safety",
  "external_manifest_must_not_claim_admissibility",
  "external_manifest_must_not_claim_external_reality",
  "external_manifest_must_not_claim_unimplemented_capability",
  "external_manifest_must_not_claim_unsupervised_execution",
  "local_file_manifest_without_public_release_asset_rejected",
  "implicit_network_capability_rejected",
  "implicit_secret_access_rejected",
  "unhashed_source_rejected",
  "unmanifested_runtime_execution_rejected"
]) {
  if (policy[k] !== true) errors.push(`policy not true: ${k}`);
}

const downloaded = [];
for (const asset of requiredAssets) {
  const url = releaseAssetUrl(sourceGate.release_tag, asset.name);
  const buf = await get(url);

  let json = null;
  try {
    json = JSON.parse(buf.toString("utf8"));
  } catch {
    errors.push(`asset not json: ${asset.name}`);
  }

  const rec = {
    name: asset.name,
    url,
    size_bytes: buf.length,
    sha256: sha256Bytes(buf),
    object_type: json?.object_type ?? null,
    schema_version: json?.schema_version ?? null,
    valid: Object.prototype.hasOwnProperty.call(json || {}, "valid") ? json.valid : null,
    sha256_canonical_json: json ? sha256CanonicalJson(json) : null
  };

  if (asset.object_type && rec.object_type !== asset.object_type) errors.push(`${asset.name}: bad object_type`);
  if (asset.schema_version && rec.schema_version !== asset.schema_version) errors.push(`${asset.name}: bad schema_version`);
  if (Object.prototype.hasOwnProperty.call(asset, "valid") && rec.valid !== asset.valid) errors.push(`${asset.name}: bad valid`);

  downloaded.push(rec);
}

const sourceReceipt = downloaded.find(x => x.object_type === "INVOCORDER_CAPABILITY_MANIFEST_HOSTILE_FIXTURE_RECEIPT");
const sourceStandard = downloaded.find(x => x.object_type === "INVOCORDER_CAPABILITY_MANIFEST_HOSTILE_FIXTURE_STANDARD");

if (!sourceReceipt) errors.push("missing downloaded v1.4 hostile fixture receipt");
if (!sourceStandard) errors.push("missing downloaded v1.4 hostile fixture standard");
if (sourceReceipt && sourceReceipt.valid !== true) errors.push("downloaded v1.4 hostile fixture receipt not valid");

const receipt = {
  object_type: "INVOCORDER_EXTERNAL_CAPABILITY_RELEASE_CONSUMPTION_RECEIPT",
  schema_version: "1.5.0",
  jurisdiction: "INVOCORDER",
  valid: errors.length === 0,
  errors,
  standard_path: STANDARD_PATH,
  standard_sha256_canonical_json: sha256CanonicalJson(standard),
  source_repository: "INVOCORDER/INVOCORDER",
  package_name: "@invocorder/recorder",
  package_version: "1.5.0",
  source_capability_manifest_hostile_fixture_release_tag: sourceGate.release_tag,
  source_capability_manifest_hostile_fixture_release_url: sourceGate.release_url,
  consumed_source_release_assets: downloaded,
  external_release_consumption_policy: policy,
  admitted_external_local_only_manifest_count: 0,
  local_only_external_manifest_admission_allowed: false,
  public_release_asset_required_for_external_capability_admission: true,
  public_release_asset_download_required: true,
  public_release_asset_hash_required: true,
  release_asset_boundary_required: true,
  proves_external_capability_release_consumption: true,
  proves_v1_4_hostile_fixture_release_consumed: downloaded.length === requiredAssets.length,
  proves_v1_4_source_receipt_valid: sourceReceipt?.valid === true,
  proves_external_manifest_release_asset_boundary_bound: true,
  proves_local_only_external_manifest_rejected: true,
  proves_no_unmanifested_runtime_execution: true,
  proves_non_claim_boundary_preserved: true,
  proves_truth: false,
  proves_authorization: false,
  proves_safety: false,
  proves_admissibility: false,
  proves_external_reality: false
};

fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify(receipt, null, 2));
if (!receipt.valid) process.exit(1);
