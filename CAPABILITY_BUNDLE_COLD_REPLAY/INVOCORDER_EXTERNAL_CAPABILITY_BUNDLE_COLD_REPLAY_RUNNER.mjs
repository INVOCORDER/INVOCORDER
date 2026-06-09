#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import https from "node:https";
import os from "node:os";
import path from "node:path";

const OWNER = "INVOCORDER";
const REPO = "INVOCORDER";
const SOURCE_TAG = "v1.7.0-external-capability-bundle-index";

const REQUIRED_ASSETS = [
  {
    name: "INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_INDEX_STANDARD.json",
    object_type: "INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_INDEX_STANDARD",
    schema_version: "1.7.0"
  },
  {
    name: "INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_INDEX.json",
    object_type: "INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_INDEX",
    schema_version: "1.7.0"
  },
  {
    name: "INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_INDEX_RECEIPT.json",
    object_type: "INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_INDEX_RECEIPT",
    schema_version: "1.7.0",
    valid: true
  }
];

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
      "User-Agent": "INVOCORDER-v1.8-external-capability-bundle-cold-replay",
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

async function main() {
  const errors = [];
  const cwd = process.cwd();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "invocorder-v180-bundle-cold-replay-"));
  const repoMarkers = [".git", "package.json", "src", "scripts", "CAPABILITY_BUNDLE_INDEX"].filter(x => fs.existsSync(path.join(cwd, x)));

  const downloaded = [];

  for (const required of REQUIRED_ASSETS) {
    const url = releaseAssetUrl(SOURCE_TAG, required.name);
    const buf = await get(url);
    const target = path.join(tempRoot, required.name);
    fs.writeFileSync(target, buf);

    let json = null;
    try {
      json = JSON.parse(buf.toString("utf8"));
    } catch {
      errors.push(`${required.name} is not JSON`);
    }

    const item = {
      name: required.name,
      url,
      temp_path: target,
      size_bytes: buf.length,
      sha256: sha256Bytes(buf),
      sha256_canonical_json: json ? sha256CanonicalJson(json) : null,
      object_type: json?.object_type ?? null,
      schema_version: json?.schema_version ?? null,
      valid: Object.prototype.hasOwnProperty.call(json || {}, "valid") ? json.valid : null,
      proves_truth: Object.prototype.hasOwnProperty.call(json || {}, "proves_truth") ? json.proves_truth : null,
      proves_authorization: Object.prototype.hasOwnProperty.call(json || {}, "proves_authorization") ? json.proves_authorization : null,
      proves_safety: Object.prototype.hasOwnProperty.call(json || {}, "proves_safety") ? json.proves_safety : null,
      proves_admissibility: Object.prototype.hasOwnProperty.call(json || {}, "proves_admissibility") ? json.proves_admissibility : null,
      proves_external_reality: Object.prototype.hasOwnProperty.call(json || {}, "proves_external_reality") ? json.proves_external_reality : null,
      json
    };

    if (required.object_type && item.object_type !== required.object_type) errors.push(`${required.name}: bad object_type`);
    if (required.schema_version && item.schema_version !== required.schema_version) errors.push(`${required.name}: bad schema_version`);
    if (Object.prototype.hasOwnProperty.call(required, "valid") && item.valid !== required.valid) errors.push(`${required.name}: bad valid`);

    for (const field of ["proves_truth", "proves_authorization", "proves_safety", "proves_admissibility", "proves_external_reality"]) {
      if (item[field] === true) errors.push(`${required.name}: ${field} must not be true`);
    }

    downloaded.push(item);
  }

  const sourceStandard = downloaded.find(x => x.object_type === "INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_INDEX_STANDARD")?.json;
  const sourceIndex = downloaded.find(x => x.object_type === "INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_INDEX")?.json;
  const sourceReceipt = downloaded.find(x => x.object_type === "INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_INDEX_RECEIPT")?.json;

  if (!sourceStandard) errors.push("source v1.7 standard not loaded");
  if (!sourceIndex) errors.push("source v1.7 bundle index not loaded");
  if (!sourceReceipt) errors.push("source v1.7 receipt not loaded");

  if (sourceReceipt) {
    if (sourceReceipt.valid !== true) errors.push("source v1.7 receipt not valid");
    if (sourceReceipt.proves_v1_2_to_v1_6_capability_chain_discoverable !== true) errors.push("source receipt does not prove v1.2-v1.6 chain discoverable");
    if (sourceReceipt.proves_all_required_release_assets_resolve !== true) errors.push("source receipt does not prove required assets resolve");
    if (sourceReceipt.proves_all_json_assets_hash_bound !== true) errors.push("source receipt does not prove JSON hash bound");
    if (sourceReceipt.proves_chain_order_explicit !== true) errors.push("source receipt does not prove chain order explicit");
    if (sourceReceipt.private_source_required !== false) errors.push("source receipt must not require private source");
    if (sourceReceipt.local_working_tree_required_for_consumers !== false) errors.push("source receipt must not require local working tree");
  }

  if (sourceIndex) {
    if (sourceIndex.total_release_count !== 5) errors.push("source index expected 5 releases");
    if ((sourceIndex.total_asset_count || 0) < 12) errors.push("source index expected at least 12 assets");
    if (sourceIndex.generated_from_public_release_assets_only !== true) errors.push("source index must be public-release-assets only");
    if (sourceIndex.private_source_required !== false) errors.push("source index must not require private source");
    if (sourceIndex.local_working_tree_required_for_consumers !== false) errors.push("source index must not require local working tree");

    const tags = (sourceIndex.chain_releases || []).map(r => r.tag);
    const expectedTags = [
      "v1.2.0-capability-admission-control",
      "v1.3.0-capability-runtime-enforcement",
      "v1.4.0-capability-manifest-hostile-fixtures",
      "v1.5.0-external-capability-release-consumption",
      "v1.6.0-external-capability-cold-replay"
    ];

    if (JSON.stringify(tags) !== JSON.stringify(expectedTags)) {
      errors.push(`source index chain order mismatch: ${JSON.stringify(tags)}`);
    }
  }

  const publicDownloaded = downloaded.map(({ json, ...x }) => x);

  const result = {
    object_type: "INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_COLD_REPLAY_RESULT",
    schema_version: "1.8.0",
    jurisdiction: "INVOCORDER",
    valid: errors.length === 0,
    errors,
    executed_from_directory: cwd,
    fresh_temporary_directory: tempRoot,
    local_repository_markers_seen_in_execution_directory: repoMarkers,
    local_repository_files_required: false,
    private_source_required: false,
    source_repository: `${OWNER}/${REPO}`,
    source_release_tag: SOURCE_TAG,
    source_release_url: `https://github.com/${OWNER}/${REPO}/releases/tag/${SOURCE_TAG}`,
    downloaded_source_release_assets: publicDownloaded,
    source_bundle_index_release_count: sourceIndex?.total_release_count ?? null,
    source_bundle_index_asset_count: sourceIndex?.total_asset_count ?? null,
    source_bundle_index_chain_tags: (sourceIndex?.chain_releases || []).map(r => r.tag),
    public_release_assets_only: true,
    local_working_tree_required_for_consumers: false,
    proves_external_capability_bundle_cold_replay: errors.length === 0,
    proves_v1_7_bundle_index_release_consumed: downloaded.length === REQUIRED_ASSETS.length,
    proves_v1_2_to_v1_6_capability_chain_discoverable_from_public_index: sourceReceipt?.proves_v1_2_to_v1_6_capability_chain_discoverable === true,
    proves_all_required_release_assets_resolve: sourceReceipt?.proves_all_required_release_assets_resolve === true,
    proves_chain_order_explicit: sourceReceipt?.proves_chain_order_explicit === true,
    proves_private_source_not_required: true,
    proves_local_working_tree_not_required: true,
    proves_non_claim_boundary_preserved: errors.length === 0,
    proves_truth: false,
    proves_authorization: false,
    proves_safety: false,
    proves_admissibility: false,
    proves_external_reality: false
  };

  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exit(1);
}

main().catch(err => {
  console.log(JSON.stringify({
    object_type: "INVOCORDER_EXTERNAL_CAPABILITY_BUNDLE_COLD_REPLAY_RESULT",
    schema_version: "1.8.0",
    jurisdiction: "INVOCORDER",
    valid: false,
    errors: [String(err.stack || err.message || err)],
    proves_truth: false,
    proves_authorization: false,
    proves_safety: false,
    proves_admissibility: false,
    proves_external_reality: false
  }, null, 2));
  process.exit(1);
});
