#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import https from "node:https";
import os from "node:os";
import path from "node:path";

const OWNER = "INVOCORDER";
const REPO = "INVOCORDER";
const SOURCE_TAG = "v1.5.0-external-capability-release-consumption";

const REQUIRED_ASSETS = [
  {
    name: "INVOCORDER_EXTERNAL_CAPABILITY_RELEASE_CONSUMPTION_STANDARD.json",
    object_type: "INVOCORDER_EXTERNAL_CAPABILITY_RELEASE_CONSUMPTION_STANDARD",
    schema_version: "1.5.0"
  },
  {
    name: "INVOCORDER_EXTERNAL_CAPABILITY_RELEASE_CONSUMPTION_RECEIPT.json",
    object_type: "INVOCORDER_EXTERNAL_CAPABILITY_RELEASE_CONSUMPTION_RECEIPT",
    schema_version: "1.5.0",
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
      "User-Agent": "INVOCORDER-v1.6-external-capability-cold-replay",
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

function assertFalse(value, label, errors) {
  if (value !== false) errors.push(`${label} must be false`);
}

async function main() {
  const errors = [];
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "invocorder-v160-cold-replay-"));
  const cwd = process.cwd();
  const repoMarkers = [".git", "package.json", "src", "scripts"].filter(x => fs.existsSync(path.join(cwd, x)));

  const downloaded = [];
  for (const required of REQUIRED_ASSETS) {
    const url = releaseAssetUrl(SOURCE_TAG, required.name);
    const buf = await get(url);
    const targetPath = path.join(tempRoot, required.name);
    fs.writeFileSync(targetPath, buf);

    let json = null;
    try {
      json = JSON.parse(buf.toString("utf8"));
    } catch {
      errors.push(`${required.name} is not JSON`);
    }

    const item = {
      name: required.name,
      url,
      temp_path: targetPath,
      size_bytes: buf.length,
      sha256: sha256Bytes(buf),
      sha256_canonical_json: json ? sha256CanonicalJson(json) : null,
      object_type: json?.object_type ?? null,
      schema_version: json?.schema_version ?? null,
      valid: Object.prototype.hasOwnProperty.call(json || {}, "valid") ? json.valid : null
    };

    if (required.object_type && item.object_type !== required.object_type) errors.push(`${required.name}: bad object_type`);
    if (required.schema_version && item.schema_version !== required.schema_version) errors.push(`${required.name}: bad schema_version`);
    if (Object.prototype.hasOwnProperty.call(required, "valid") && item.valid !== required.valid) errors.push(`${required.name}: bad valid`);

    item.json = json;
    downloaded.push(item);
  }

  const sourceStandard = downloaded.find(x => x.object_type === "INVOCORDER_EXTERNAL_CAPABILITY_RELEASE_CONSUMPTION_STANDARD")?.json;
  const sourceReceipt = downloaded.find(x => x.object_type === "INVOCORDER_EXTERNAL_CAPABILITY_RELEASE_CONSUMPTION_RECEIPT")?.json;

  if (!sourceStandard) errors.push("source v1.5 standard not loaded");
  if (!sourceReceipt) errors.push("source v1.5 receipt not loaded");

  if (sourceReceipt) {
    if (sourceReceipt.valid !== true) errors.push("source v1.5 receipt not valid");
    if (sourceReceipt.local_only_external_manifest_admission_allowed !== false) errors.push("local-only external manifest admission must be blocked");
    if (sourceReceipt.public_release_asset_required_for_external_capability_admission !== true) errors.push("public release asset must be required");
    if (sourceReceipt.release_asset_boundary_required !== true) errors.push("release asset boundary must be required");
    if (sourceReceipt.proves_truth !== false) errors.push("source receipt must not prove truth");
    if (sourceReceipt.proves_authorization !== false) errors.push("source receipt must not prove authorization");
    if (sourceReceipt.proves_safety !== false) errors.push("source receipt must not prove safety");
    if (sourceReceipt.proves_admissibility !== false) errors.push("source receipt must not prove admissibility");
    if (sourceReceipt.proves_external_reality !== false) errors.push("source receipt must not prove external reality");
  }

  if (sourceStandard) {
    const policy = sourceStandard.external_release_consumption_policy || {};
    for (const k of [
      "external_manifest_must_be_public_release_asset",
      "external_manifest_must_have_bound_release_asset_boundary",
      "external_manifest_must_have_sha256_or_canonical_sha256",
      "external_manifest_must_preserve_non_claim_boundary",
      "local_file_manifest_without_public_release_asset_rejected"
    ]) {
      if (policy[k] !== true) errors.push(`source policy not true: ${k}`);
    }
  }

  const publicShape = downloaded.map(({ json, ...rest }) => rest);

  const result = {
    object_type: "INVOCORDER_EXTERNAL_CAPABILITY_COLD_REPLAY_RESULT",
    schema_version: "1.6.0",
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
    downloaded_source_release_assets: publicShape,
    source_receipt_valid: sourceReceipt?.valid === true,
    local_only_external_manifest_admission_allowed: false,
    public_release_asset_required_for_external_capability_admission: true,
    release_asset_boundary_required: true,
    proves_external_capability_cold_replay: errors.length === 0,
    proves_v1_5_external_release_consumption_release_consumed: downloaded.length === REQUIRED_ASSETS.length,
    proves_local_only_external_manifest_blocked: sourceReceipt?.local_only_external_manifest_admission_allowed === false,
    proves_release_asset_boundary_required: sourceReceipt?.release_asset_boundary_required === true,
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
    object_type: "INVOCORDER_EXTERNAL_CAPABILITY_COLD_REPLAY_RESULT",
    schema_version: "1.6.0",
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
