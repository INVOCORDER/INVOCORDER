#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import https from "node:https";

const STANDARD_PATH = "PUBLIC_CONTROL_CHAIN_CLOSURE/INVOCORDER_PUBLIC_CONTROL_CHAIN_CLOSURE_STANDARD.json";
const CLOSURE_PATH = "PUBLIC_CONTROL_CHAIN_CLOSURE/INVOCORDER_PUBLIC_CONTROL_CHAIN_CLOSURE.json";
const RECEIPT_PATH = "PUBLIC_CONTROL_CHAIN_CLOSURE/INVOCORDER_PUBLIC_CONTROL_CHAIN_CLOSURE_RECEIPT.json";
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

function sha256Text(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function sha256CanonicalJson(obj) {
  return sha256Text(stable(obj));
}

function get(url) {
  return new Promise((resolve, reject) => {
    const headers = {
      "User-Agent": "INVOCORDER-v2.0-public-control-chain-closure",
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

if (standard.object_type !== "INVOCORDER_PUBLIC_CONTROL_CHAIN_CLOSURE_STANDARD") errors.push("bad standard object_type");
if (standard.schema_version !== "2.0.0") errors.push("bad standard schema_version");
if (standard.jurisdiction !== "INVOCORDER") errors.push("bad jurisdiction");

const sourceGate = standard.source_gate || {};
const policy = standard.closure_policy || {};
const chainScope = standard.chain_scope || {};

for (const k of [
  "must_consume_v1_9_capsule_release_assets",
  "must_verify_v1_9_capsule_receipt_validity",
  "must_bind_capsule_digest",
  "must_bind_v1_2_to_v1_9_public_control_chain",
  "must_preserve_public_release_asset_only_boundary",
  "must_preserve_private_source_not_required_boundary",
  "must_preserve_local_working_tree_not_required_boundary",
  "must_preserve_non_claim_boundary",
  "must_publish_closure_receipt"
]) {
  if (policy[k] !== true) errors.push(`policy not true: ${k}`);
}

if (chainScope.starts_at !== "v1.2.0-capability-admission-control") errors.push("bad chain starts_at");
if (chainScope.ends_at !== "v1.9.0-external-capability-capsule-digest") errors.push("bad chain ends_at");
if (chainScope.ordered_release_count !== 8) errors.push("bad ordered_release_count");
if (chainScope.public_release_assets_only !== true) errors.push("public release asset only boundary broken");
if (chainScope.private_source_required !== false) errors.push("private source boundary broken");
if (chainScope.local_working_tree_required_for_consumers !== false) errors.push("local working tree boundary broken");

for (const [k, v] of Object.entries(standard.required_non_claim_boundary || {})) {
  if (v !== false) errors.push(`non-claim ${k} must be false`);
}

const downloaded = [];

for (const required of sourceGate.required_assets || []) {
  const url = releaseAssetUrl(sourceGate.release_tag, required.name);
  const buf = await get(url);

  let json = null;
  let jsonError = null;

  if (required.name.endsWith(".json")) {
    try {
      json = JSON.parse(buf.toString("utf8"));
    } catch (e) {
      jsonError = String(e.message || e);
      errors.push(`${required.name}: JSON parse failed`);
    }
  }

  const item = {
    name: required.name,
    url,
    size_bytes: buf.length,
    sha256: sha256Bytes(buf),
    is_json: required.name.endsWith(".json"),
    json_parse_error: jsonError,
    sha256_canonical_json: json ? sha256CanonicalJson(json) : null,
    object_type: json?.object_type ?? null,
    schema_version: json?.schema_version ?? null,
    valid: Object.prototype.hasOwnProperty.call(json || {}, "valid") ? json.valid : null,
    capsule_digest_sha256: json?.capsule_digest_sha256 ?? null,
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

  if (item.is_json && !item.sha256_canonical_json) errors.push(`${required.name}: missing canonical JSON hash`);

  for (const field of ["proves_truth", "proves_authorization", "proves_safety", "proves_admissibility", "proves_external_reality"]) {
    if (item[field] === true) errors.push(`${required.name}: ${field} must not be true`);
  }

  downloaded.push(item);
}

const sourceCapsule = downloaded.find(x => x.object_type === "INVOCORDER_EXTERNAL_CAPABILITY_CAPSULE_DIGEST")?.json;
const sourceReceipt = downloaded.find(x => x.object_type === "INVOCORDER_EXTERNAL_CAPABILITY_CAPSULE_DIGEST_RECEIPT")?.json;

if (!sourceCapsule) errors.push("source v1.9 capsule not found");
if (!sourceReceipt) errors.push("source v1.9 receipt not found");

if (sourceReceipt) {
  if (sourceReceipt.valid !== true) errors.push("source v1.9 receipt not valid");
  if (sourceReceipt.proves_external_capability_capsule_digest !== true) errors.push("source receipt does not prove capsule digest");
  if (sourceReceipt.proves_chain_scope_v1_2_to_v1_8_bound !== true) errors.push("source receipt does not bind v1.2-v1.8 scope");
  if (sourceReceipt.proves_private_source_not_required !== true) errors.push("source receipt does not prove private source not required");
  if (sourceReceipt.proves_local_working_tree_not_required !== true) errors.push("source receipt does not prove local working tree not required");
}

if (sourceCapsule) {
  if (sourceCapsule.public_release_assets_only !== true) errors.push("source capsule public release only boundary broken");
  if (sourceCapsule.private_source_required !== false) errors.push("source capsule private source boundary broken");
  if (sourceCapsule.local_working_tree_required_for_consumers !== false) errors.push("source capsule local working tree boundary broken");
  if (!sourceCapsule.capsule_digest_sha256) errors.push("source capsule digest missing");
}

const publicAssets = downloaded.map(({ json, ...item }) => item);

const closureDigestInput = {
  object_type: "INVOCORDER_PUBLIC_CONTROL_CHAIN_CLOSURE_DIGEST_INPUT",
  schema_version: "2.0.0",
  source_repository: `${OWNER}/${REPO}`,
  source_release_tag: sourceGate.release_tag,
  chain_scope: chainScope,
  source_capsule_digest_sha256: sourceCapsule?.capsule_digest_sha256 ?? null,
  ordered_source_assets: publicAssets.map(a => ({
    name: a.name,
    sha256: a.sha256,
    sha256_canonical_json: a.sha256_canonical_json,
    object_type: a.object_type,
    schema_version: a.schema_version,
    valid: a.valid,
    capsule_digest_sha256: a.capsule_digest_sha256
  })),
  non_claim_boundary: {
    claims_truth: false,
    claims_authorization: false,
    claims_safety: false,
    claims_admissibility: false,
    claims_external_reality: false
  }
};

const closureDigest = sha256CanonicalJson(closureDigestInput);

const closure = {
  object_type: "INVOCORDER_PUBLIC_CONTROL_CHAIN_CLOSURE",
  schema_version: "2.0.0",
  jurisdiction: "INVOCORDER",
  source_repository: `${OWNER}/${REPO}`,
  package_name: "@invocorder/recorder",
  package_version: "2.0.0",
  source_release_tag: sourceGate.release_tag,
  source_release_url: sourceGate.release_url,
  chain_scope: chainScope,
  source_capsule_digest_sha256: sourceCapsule?.capsule_digest_sha256 ?? null,
  closure_digest_algorithm: "sha256_canonical_json",
  closure_digest_sha256: closureDigest,
  closure_digest_input: closureDigestInput,
  public_release_assets_only: true,
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

fs.writeFileSync(CLOSURE_PATH, JSON.stringify(closure, null, 2) + "\n");

const receipt = {
  object_type: "INVOCORDER_PUBLIC_CONTROL_CHAIN_CLOSURE_RECEIPT",
  schema_version: "2.0.0",
  jurisdiction: "INVOCORDER",
  valid: errors.length === 0,
  errors,
  standard_path: STANDARD_PATH,
  standard_sha256_canonical_json: sha256CanonicalJson(standard),
  closure_path: CLOSURE_PATH,
  closure_sha256_canonical_json: sha256CanonicalJson(closure),
  closure_digest_sha256: closureDigest,
  source_repository: `${OWNER}/${REPO}`,
  package_name: "@invocorder/recorder",
  package_version: "2.0.0",
  source_release_tag: sourceGate.release_tag,
  source_release_url: sourceGate.release_url,
  source_capsule_digest_sha256: sourceCapsule?.capsule_digest_sha256 ?? null,
  consumed_source_release_assets: publicAssets,
  chain_scope: chainScope,
  public_release_assets_only: true,
  private_source_required: false,
  local_working_tree_required_for_consumers: false,
  proves_public_control_chain_closure: errors.length === 0,
  proves_v1_9_external_capability_capsule_digest_release_consumed: errors.length === 0,
  proves_source_capsule_digest_bound: !!sourceCapsule?.capsule_digest_sha256,
  proves_closure_digest_bound: errors.length === 0,
  proves_chain_scope_v1_2_to_v1_9_bound: errors.length === 0,
  proves_private_source_not_required: true,
  proves_local_working_tree_not_required: true,
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
