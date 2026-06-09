#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import https from "node:https";

const STANDARD_PATH = "CAPABILITY_BUNDLE_INDEX/INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_INDEX_STANDARD.json";
const RECEIPT_PATH = "CAPABILITY_BUNDLE_INDEX/INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_INDEX_RECEIPT.json";
const INDEX_PATH = "CAPABILITY_BUNDLE_INDEX/INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_INDEX.json";
const OWNER = "INVOCORDER";
const REPO = "INVOCORDER";

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
    const headers = {
      "User-Agent": "INVOCORDER-v1.7-external-capability-bundle-index",
      "Accept": "application/octet-stream"
    };
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
    if (token) headers.Authorization = `Bearer ${token}`;

    const req = https.get(url, { headers }, res => {
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
  return `https://github.com/${OWNER}/${REPO}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`;
}

const standard = readJson(STANDARD_PATH);
const errors = [];

if (standard.object_type !== "INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_INDEX_STANDARD") errors.push("bad standard object_type");
if (standard.schema_version !== "1.7.0") errors.push("bad standard schema_version");
if (standard.jurisdiction !== "INVOCORDER") errors.push("bad jurisdiction");

const scope = standard.capability_chain_scope || {};
if (scope.requires_public_release_assets_only !== true) errors.push("scope must require public release assets only");
if (scope.requires_private_source !== false) errors.push("scope must not require private source");
if (scope.requires_local_working_tree !== false) errors.push("scope must not require local working tree");

for (const [k, v] of Object.entries(standard.required_non_claim_boundary || {})) {
  if (v !== false) errors.push(`non-claim ${k} must be false`);
}

const releaseSummaries = [];

for (const release of standard.chain_releases || []) {
  const assetSummaries = [];

  for (const name of release.required_assets || []) {
    const url = releaseAssetUrl(release.tag, name);
    const buf = await get(url);

    let json = null;
    let jsonError = null;

    if (name.endsWith(".json")) {
      try {
        json = JSON.parse(buf.toString("utf8"));
      } catch (e) {
        jsonError = String(e.message || e);
        errors.push(`${release.tag}/${name}: json parse failed`);
      }
    }

    const item = {
      name,
      url,
      size_bytes: buf.length,
      sha256: sha256Bytes(buf),
      is_json: name.endsWith(".json"),
      json_parse_error: jsonError,
      sha256_canonical_json: json ? sha256CanonicalJson(json) : null,
      object_type: json?.object_type ?? null,
      schema_version: json?.schema_version ?? null,
      valid: Object.prototype.hasOwnProperty.call(json || {}, "valid") ? json.valid : null,
      proves_truth: Object.prototype.hasOwnProperty.call(json || {}, "proves_truth") ? json.proves_truth : null,
      proves_authorization: Object.prototype.hasOwnProperty.call(json || {}, "proves_authorization") ? json.proves_authorization : null,
      proves_safety: Object.prototype.hasOwnProperty.call(json || {}, "proves_safety") ? json.proves_safety : null,
      proves_admissibility: Object.prototype.hasOwnProperty.call(json || {}, "proves_admissibility") ? json.proves_admissibility : null,
      proves_external_reality: Object.prototype.hasOwnProperty.call(json || {}, "proves_external_reality") ? json.proves_external_reality : null
    };

    if (item.is_json && !item.sha256_canonical_json) errors.push(`${release.tag}/${name}: missing canonical JSON sha`);
    if (item.is_json && item.valid === false) errors.push(`${release.tag}/${name}: valid false`);

    if (item.is_json) {
      for (const field of ["proves_truth", "proves_authorization", "proves_safety", "proves_admissibility", "proves_external_reality"]) {
        if (item[field] === true) errors.push(`${release.tag}/${name}: ${field} must not be true`);
      }
    }

    assetSummaries.push(item);
  }

  releaseSummaries.push({
    tag: release.tag,
    role: release.role,
    required_asset_count: (release.required_assets || []).length,
    resolved_asset_count: assetSummaries.length,
    assets: assetSummaries
  });
}

if (releaseSummaries.length !== 5) errors.push("expected 5 chain releases");

const totalAssets = releaseSummaries.flatMap(r => r.assets).length;
if (totalAssets < 12) errors.push("expected at least 12 public capability chain assets");

const bundleIndex = {
  object_type: "INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_INDEX",
  schema_version: "1.7.0",
  jurisdiction: "INVOCORDER",
  source_repository: `${OWNER}/${REPO}`,
  capability_chain_scope: standard.capability_chain_scope,
  chain_releases: releaseSummaries,
  total_release_count: releaseSummaries.length,
  total_asset_count: totalAssets,
  generated_from_public_release_assets_only: true,
  private_source_required: false,
  local_working_tree_required_for_consumers: false,
  non_claim_boundary: {
    claims_truth: false,
    claims_authorization: false,
    claims_safety: false,
    claims_admissibility: false,
    claims_external_reality: false
  }
};

fs.writeFileSync(INDEX_PATH, JSON.stringify(bundleIndex, null, 2) + "\n");

const receipt = {
  object_type: "INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_INDEX_RECEIPT",
  schema_version: "1.7.0",
  jurisdiction: "INVOCORDER",
  valid: errors.length === 0,
  errors,
  standard_path: STANDARD_PATH,
  standard_sha256_canonical_json: sha256CanonicalJson(standard),
  bundle_index_path: INDEX_PATH,
  bundle_index_sha256_canonical_json: sha256CanonicalJson(bundleIndex),
  source_repository: `${OWNER}/${REPO}`,
  package_name: "@invocorder/recorder",
  package_version: "1.7.0",
  total_release_count: releaseSummaries.length,
  total_asset_count: totalAssets,
  chain_release_tags: releaseSummaries.map(r => r.tag),
  public_release_assets_only: true,
  local_working_tree_required_for_consumers: false,
  private_source_required: false,
  proves_external_capability_bundle_index: errors.length === 0,
  proves_v1_2_to_v1_6_capability_chain_discoverable: errors.length === 0,
  proves_all_required_release_assets_resolve: errors.length === 0,
  proves_all_json_assets_hash_bound: errors.length === 0,
  proves_chain_order_explicit: errors.length === 0,
  proves_non_claim_boundary_preserved: errors.length === 0,
  proves_truth: false,
  proves_authorization: false,
  proves_safety: false,
  proves_admissibility: false,
  proves_external_reality: false
};

fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify(receipt, null, 2));
if (!receipt.valid) process.exit(1);
