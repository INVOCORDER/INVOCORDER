#!/usr/bin/env node
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const https = require("node:https");
const child_process = require("node:child_process");

const OWNER = "INVOCORDER";
const REPO = "INVOCORDER";
const SOURCE_TAG = "v1.2.0-capability-admission-control";

const STANDARD_PATH = "CAPABILITY_RUNTIME/INVOCORDER_CAPABILITY_RUNTIME_ENFORCEMENT_STANDARD.json";
const RECEIPT_PATH = "CAPABILITY_RUNTIME/INVOCORDER_CAPABILITY_RUNTIME_ENFORCEMENT_RECEIPT.json";

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function readJson(p) {
  return JSON.parse(readText(p));
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonical(value));
}

function sha256CanonicalJson(value) {
  return sha256(Buffer.from(canonicalJson(value)));
}

function requireEqual(actual, expected, label, errors) {
  if (actual !== expected) errors.push(`${label}: expected ${expected}; got ${actual}`);
}

function token() {
  return process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
}

function githubJson(urlPath) {
  const headers = {
    "User-Agent": "INVOCORDER-v1.3-runtime-enforcement",
    "Accept": "application/vnd.github+json"
  };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.github.com",
      path: urlPath,
      method: "GET",
      headers
    }, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", c => body += c);
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`GET https://api.github.com${urlPath} -> ${res.statusCode}: ${body}`));
          return;
        }
        resolve(JSON.parse(body));
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function download(url) {
  const headers = { "User-Agent": "INVOCORDER-v1.3-runtime-enforcement" };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;

  return new Promise((resolve, reject) => {
    https.get(url, { headers }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        download(res.headers.location).then(resolve, reject);
        return;
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`download ${url} -> ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}

function listFiles(root) {
  const out = [];
  if (!fs.existsSync(root)) return out;

  function walk(p) {
    for (const ent of fs.readdirSync(p, { withFileTypes: true })) {
      const full = path.join(p, ent.name);
      const rel = full.split(path.sep).join("/");
      if (ent.isDirectory()) {
        if ([".git", "node_modules", ".invocorder"].includes(ent.name)) continue;
        walk(full);
      } else if (ent.isFile()) {
        out.push(rel);
      }
    }
  }

  walk(root);
  return out.sort();
}

function textMaybe(p) {
  try {
    const b = fs.readFileSync(p);
    if (b.includes(0)) return "";
    return b.toString("utf8");
  } catch {
    return "";
  }
}

function grepRuntimeSurfaces(files, forbidden) {
  const findings = [];
  for (const file of files) {
    const txt = textMaybe(file);
    if (!txt) continue;
    const lower = txt.toLowerCase();
    for (const pat of forbidden) {
      if (lower.includes(pat.toLowerCase())) {
        findings.push({ path: file, pattern: pat });
      }
    }
  }
  return findings;
}

function safePackageSurface(pkg) {
  return {
    bin: pkg.bin || {},
    scripts: pkg.scripts || {},
    dependencies: Object.keys(pkg.dependencies || {}).sort(),
    devDependencies: Object.keys(pkg.devDependencies || {}).sort()
  };
}

async function main() {
  const errors = [];
  const standard = readJson(STANDARD_PATH);
  const pkg = readJson("package.json");

  requireEqual(standard.object_type, "INVOCORDER_CAPABILITY_RUNTIME_ENFORCEMENT_STANDARD", "standard object_type", errors);
  requireEqual(standard.schema_version, "1.3.0", "standard schema_version", errors);

  let release = null;
  let downloadedAssets = [];
  let admissionRegistry = null;
  let admissionStandard = null;
  let manifestTemplate = null;

  try {
    release = await githubJson(`/repos/${OWNER}/${REPO}/releases/tags/${SOURCE_TAG}`);
    const assetsByName = new Map((release.assets || []).map(a => [a.name, a]));

    for (const name of standard.source_admission_release_assets_required) {
      const asset = assetsByName.get(name);
      if (!asset) {
        errors.push(`missing v1.2 release asset: ${name}`);
        continue;
      }

      const buf = await download(asset.browser_download_url);
      const assetResult = {
        name,
        size_bytes: buf.length,
        sha256: sha256(buf),
        browser_download_url: asset.browser_download_url
      };

      if (name.endsWith(".json")) {
        const parsed = JSON.parse(buf.toString("utf8"));
        assetResult.sha256_canonical_json = sha256CanonicalJson(parsed);
        assetResult.object_type = parsed.object_type || null;
        assetResult.schema_version = parsed.schema_version || null;
        assetResult.valid = Object.prototype.hasOwnProperty.call(parsed, "valid") ? parsed.valid : null;

        if (name === "INVOCORDER_CAPABILITY_ADMISSION_REGISTRY.json") admissionRegistry = parsed;
        if (name === "INVOCORDER_CAPABILITY_ADMISSION_STANDARD.json") admissionStandard = parsed;
        if (name === "CAPABILITY_MANIFEST_TEMPLATE.json") manifestTemplate = parsed;
      }

      downloadedAssets.push(assetResult);
    }
  } catch (e) {
    errors.push(e.message);
  }

  if (!admissionRegistry) errors.push("v1.2 admission registry not downloaded");
  if (!admissionStandard) errors.push("v1.2 admission standard not downloaded");
  if (!manifestTemplate) errors.push("v1.2 manifest template not downloaded");

  if (admissionRegistry) {
    requireEqual(admissionRegistry.object_type, "INVOCORDER_CAPABILITY_ADMISSION_REGISTRY", "admission registry object_type", errors);
    requireEqual(admissionRegistry.schema_version, "1.2.0", "admission registry schema_version", errors);
    requireEqual(admissionRegistry.valid, true, "admission registry valid", errors);
    requireEqual(admissionRegistry.admission_default, "closed_until_manifest_bound", "admission default", errors);
    requireEqual(admissionRegistry.admitted_external_manifest_count, 0, "admitted external manifest count", errors);
    requireEqual(admissionRegistry.unmanifested_execution_allowed, false, "unmanifested execution allowed", errors);
    requireEqual(admissionRegistry.implicit_plugin_loading_allowed, false, "implicit plugin loading", errors);
    requireEqual(admissionRegistry.implicit_addon_loading_allowed, false, "implicit addon loading", errors);
    requireEqual(admissionRegistry.implicit_external_runner_allowed, false, "implicit external runner", errors);
    requireEqual(admissionRegistry.implicit_network_capability_allowed, false, "implicit network capability", errors);
    requireEqual(admissionRegistry.implicit_secret_access_allowed, false, "implicit secret access", errors);
    requireEqual(admissionRegistry.implicit_truth_claim_allowed, false, "implicit truth claim", errors);
  }

  const packageSurface = safePackageSurface(pkg);

  const workflowFiles = listFiles(".github/workflows");
  const scriptFiles = listFiles("scripts");
  const sourceFiles = listFiles("src");
  const runtimeFiles = listFiles("CAPABILITY_RUNTIME");

  const scannedRuntimeFiles = [
    ...workflowFiles,
    ...scriptFiles,
    ...sourceFiles,
    "package.json",
    "bin/invocorder.js"
  ].filter(f => fs.existsSync(f));

  const rawFindings = grepRuntimeSurfaces(
    scannedRuntimeFiles,
    standard.forbidden_runtime_patterns_without_manifest || []
  );

  const allowedFindingPaths = new Set([
    "scripts/verify-capability-runtime-enforcement.mjs",
    "CAPABILITY_RUNTIME/INVOCORDER_CAPABILITY_RUNTIME_ENFORCEMENT_STANDARD.json",
    "CAPABILITY_ADMISSION/INVOCORDER_CAPABILITY_ADMISSION_STANDARD.json",
    "CAPABILITY_ADMISSION/CAPABILITY_MANIFEST_TEMPLATE.json",
    "CAPABILITY_ADMISSION/INVOCORDER_CAPABILITY_ADMISSION_REGISTRY.json",
    "README.md"
  ]);

  const unmanifestedRuntimeFindings = rawFindings.filter(f => !allowedFindingPaths.has(f.path) && !/^scripts\/verify-capability-.*\.mjs$/.test(f.path));

  const futureSlots = admissionRegistry?.future_extension_admission_slots || [];
  const allFutureSlotsClosed = futureSlots.length > 0 && futureSlots.every(s =>
    s.admission_state === "closed_until_manifest_bound" &&
    s.unmanifested_execution_allowed === false &&
    s.manifest_required === true
  );

  if (!allFutureSlotsClosed) errors.push("not all future extension admission slots are closed");

  const noExternalAdmitted = admissionRegistry && admissionRegistry.admitted_external_manifest_count === 0;
  const runtimeDenyDefault = standard.runtime_default === "deny_unmanifested_capability_execution";
  const noForbiddenRuntimeFindings = unmanifestedRuntimeFindings.length === 0;

  if (!noForbiddenRuntimeFindings) {
    errors.push(`unmanifested runtime capability references found: ${JSON.stringify(unmanifestedRuntimeFindings.slice(0, 20))}`);
  }

  const nonClaim = standard.required_non_claim_boundary || {};
  for (const [k, v] of Object.entries(nonClaim)) {
    if (v !== false) errors.push(`non-claim boundary ${k} must be false`);
  }

  const valid = errors.length === 0;

  const receipt = {
    object_type: "INVOCORDER_CAPABILITY_RUNTIME_ENFORCEMENT_RECEIPT",
    schema_version: "1.3.0",
    jurisdiction: "INVOCORDER",
    valid,
    errors,
    standard_path: STANDARD_PATH,
    standard_sha256_canonical_json: sha256CanonicalJson(standard),
    source_repository: `${OWNER}/${REPO}`,
    package_name: pkg.name,
    package_version: "1.3.0",
    source_admission_release_tag: SOURCE_TAG,
    source_admission_release_url: release?.html_url || `https://github.com/${OWNER}/${REPO}/releases/tag/${SOURCE_TAG}`,
    consumed_source_admission_release_assets: downloadedAssets,
    source_admission_summary: admissionRegistry ? {
      object_type: admissionRegistry.object_type,
      schema_version: admissionRegistry.schema_version,
      valid: admissionRegistry.valid,
      admission_default: admissionRegistry.admission_default,
      admitted_external_manifest_count: admissionRegistry.admitted_external_manifest_count,
      rejected_or_closed_slots_count: admissionRegistry.rejected_or_closed_slots_count,
      unmanifested_execution_allowed: admissionRegistry.unmanifested_execution_allowed,
      implicit_plugin_loading_allowed: admissionRegistry.implicit_plugin_loading_allowed,
      implicit_addon_loading_allowed: admissionRegistry.implicit_addon_loading_allowed,
      implicit_external_runner_allowed: admissionRegistry.implicit_external_runner_allowed,
      implicit_network_capability_allowed: admissionRegistry.implicit_network_capability_allowed,
      implicit_secret_access_allowed: admissionRegistry.implicit_secret_access_allowed,
      proves_capability_admission_control: admissionRegistry.proves_capability_admission_control,
      proves_future_slots_default_closed: admissionRegistry.proves_future_slots_default_closed,
      proves_no_unmanifested_future_execution: admissionRegistry.proves_no_unmanifested_future_execution
    } : null,
    package_runtime_surface: packageSurface,
    workflow_count: workflowFiles.length,
    workflow_files: workflowFiles,
    verifier_script_count: scriptFiles.filter(f => /verify-.*\.mjs$/.test(f)).length,
    runtime_enforcement_files: runtimeFiles,
    scanned_runtime_file_count: scannedRuntimeFiles.length,
    scanned_runtime_files: scannedRuntimeFiles,
    forbidden_runtime_pattern_findings_allowed_only_in_policy_files: rawFindings,
    unmanifested_runtime_findings: unmanifestedRuntimeFindings,
    future_extension_slots_closed: allFutureSlotsClosed,
    runtime_deny_default: runtimeDenyDefault,
    no_external_manifest_admitted: noExternalAdmitted,
    unmanifested_execution_allowed: false,
    implicit_plugin_loading_allowed: false,
    implicit_addon_loading_allowed: false,
    implicit_external_runner_allowed: false,
    implicit_network_capability_allowed: false,
    implicit_secret_access_allowed: false,
    implicit_policy_engine_allowed: false,
    implicit_schema_expansion_allowed: false,
    implicit_fixture_expansion_allowed: false,
    implicit_auditor_expansion_allowed: false,
    local_working_tree_required_for_runtime_enforcement: false,
    private_source_required: false,
    public_release_asset_download_required_for_source_admission: true,
    proves_capability_runtime_enforcement_gate: valid && runtimeDenyDefault,
    proves_v1_2_admission_control_consumed: valid && !!admissionRegistry,
    proves_future_slots_runtime_denied_by_default: valid && allFutureSlotsClosed,
    proves_no_unmanifested_runtime_capability_surface: valid && noForbiddenRuntimeFindings,
    proves_no_external_manifest_admitted: valid && noExternalAdmitted,
    proves_manifest_required_before_runtime_execution: valid && allFutureSlotsClosed,
    proves_plugin_addon_runner_network_secret_capabilities_blocked: valid,
    proves_non_claim_boundary_preserved: valid,
    proves_truth: false,
    proves_authorization: false,
    proves_safety: false,
    proves_admissibility: false,
    proves_external_reality: false
  };

  writeJson(RECEIPT_PATH, receipt);
  console.log(JSON.stringify(receipt, null, 2));
  if (!valid) process.exit(1);
}

main().catch(e => {
  const receipt = {
    object_type: "INVOCORDER_CAPABILITY_RUNTIME_ENFORCEMENT_RECEIPT",
    schema_version: "1.3.0",
    jurisdiction: "INVOCORDER",
    valid: false,
    errors: [e.message],
    proves_truth: false,
    proves_authorization: false,
    proves_safety: false,
    proves_admissibility: false,
    proves_external_reality: false
  };
  writeJson(RECEIPT_PATH, receipt);
  console.log(JSON.stringify(receipt, null, 2));
  process.exit(1);
});
