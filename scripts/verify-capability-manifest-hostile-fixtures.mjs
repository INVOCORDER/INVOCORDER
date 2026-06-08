#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import https from "node:https";

const REPO = "INVOCORDER/INVOCORDER";
const STANDARD_PATH = "CAPABILITY_MANIFEST_FIXTURES/INVOCORDER_CAPABILITY_MANIFEST_HOSTILE_FIXTURE_STANDARD.json";
const RECEIPT_PATH = "CAPABILITY_MANIFEST_FIXTURES/INVOCORDER_CAPABILITY_MANIFEST_HOSTILE_FIXTURE_RECEIPT.json";
const TEMPLATE_PATH = "CAPABILITY_ADMISSION/CAPABILITY_MANIFEST_TEMPLATE.json";

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function sha256CanonicalJson(value) {
  return sha256Text(canonical(value));
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function request(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
    const finalHeaders = {
      "User-Agent": "INVOCORDER-v1.4-capability-manifest-hostile-fixtures",
      "Accept": "application/vnd.github+json",
      ...headers
    };
    if (token) finalHeaders.Authorization = `Bearer ${token}`;

    https.get(url, { headers: finalHeaders }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode || 0) && res.headers.location) {
        request(res.headers.location, headers).then(resolve, reject);
        return;
      }
      let chunks = [];
      res.on("data", d => chunks.push(d));
      res.on("end", () => {
        const body = Buffer.concat(chunks);
        if ((res.statusCode || 0) >= 400) {
          reject(new Error(`GET ${url} -> ${res.statusCode}: ${body.toString("utf8").slice(0, 500)}`));
          return;
        }
        resolve(body);
      });
    }).on("error", reject);
  });
}

async function getReleaseAssets(tag) {
  const url = `https://api.github.com/repos/${REPO}/releases/tags/${encodeURIComponent(tag)}`;
  const body = await request(url);
  const release = JSON.parse(body.toString("utf8"));
  return release.assets.map(a => ({
    name: a.name,
    size_bytes: a.size,
    browser_download_url: a.browser_download_url
  }));
}

async function downloadAsset(asset) {
  const body = await request(asset.browser_download_url, { Accept: "application/octet-stream" });
  const text = body.toString("utf8");
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return {
    name: asset.name,
    size_bytes: body.length,
    sha256: sha256Text(text),
    sha256_canonical_json: json ? sha256CanonicalJson(json) : null,
    object_type: json?.object_type ?? null,
    schema_version: json?.schema_version ?? null,
    valid: typeof json?.valid === "boolean" ? json.valid : null,
    json
  };
}

function isHex64(v) {
  return typeof v === "string" && /^[a-f0-9]{64}$/i.test(v);
}

function validateManifest(m, standard) {
  const errors = [];
  for (const field of standard.required_manifest_fields) {
    if (!(field in m)) errors.push(`missing required field: ${field}`);
  }

  if (m.object_type !== "INVOCORDER_CAPABILITY_MANIFEST") errors.push("bad object_type");
  if (m.schema_version !== "1.2.0") errors.push("bad manifest schema_version");
  if (!standard.allowed_implementation_statuses.includes(m.implementation_status)) {
    errors.push("implementation_status not allowed");
  }

  if (!Array.isArray(m.source_files)) errors.push("source_files must be array");
  if (!m.hash_basis || typeof m.hash_basis !== "object") errors.push("hash_basis must be object");
  if (!m.executable_surface || typeof m.executable_surface !== "object") errors.push("executable_surface must be object");
  if (!m.network_boundary || typeof m.network_boundary !== "object") errors.push("network_boundary must be object");
  if (!m.secret_boundary || typeof m.secret_boundary !== "object") errors.push("secret_boundary must be object");
  if (!m.release_asset_boundary || typeof m.release_asset_boundary !== "object") errors.push("release_asset_boundary must be object");
  if (!m.non_claim_boundary || typeof m.non_claim_boundary !== "object") errors.push("non_claim_boundary must be object");

  for (const [k, expected] of Object.entries(standard.required_non_claim_boundary)) {
    if (m.non_claim_boundary && m.non_claim_boundary[k] !== expected) {
      errors.push(`${k} must be false`);
    }
  }

  if (m.network_boundary?.implicit_network_capability_allowed !== false) {
    errors.push("implicit_network_capability_allowed must be false");
  }
  if (m.secret_boundary?.implicit_secret_access_allowed !== false) {
    errors.push("implicit_secret_access_allowed must be false");
  }
  if (m.executable_surface?.unmanifested_execution_allowed !== false) {
    errors.push("unmanifested_execution_allowed must be false");
  }
  if (m.dependency_boundary?.implicit_dependencies_allowed !== false) {
    errors.push("implicit_dependencies_allowed must be false");
  }
  if (m.hash_basis?.unhashed_source_allowed !== false) {
    errors.push("unhashed_source_allowed must be false");
  }

  const boundImplementation = ["first_party_present_bound", "external_public_release_bound"].includes(m.implementation_status);
  if (boundImplementation) {
    if (!Array.isArray(m.source_files) || m.source_files.length === 0) {
      errors.push("bound implementations require source_files");
    }
    for (const sf of m.source_files || []) {
      if (!sf.path) errors.push("source file path required");
      if (!isHex64(sf.sha256)) errors.push("source file sha256 required");
    }
  }

  if (m.implementation_status === "external_public_release_bound") {
    const b = m.release_asset_boundary || {};
    if (!b.public_release_url || !Array.isArray(b.release_assets) || b.release_assets.length === 0) {
      errors.push("external_public_release_bound requires release assets");
    }
    for (const asset of b.release_assets || []) {
      if (!asset.name) errors.push("release asset name required");
      if (!isHex64(asset.sha256)) errors.push("release asset sha256 required");
    }
  }

  if (m.implementation_status === "declared_extension_boundary_not_implemented") {
    if (m.executable_surface?.executable === true || m.executable_surface?.executable_allowed === true) {
      errors.push("unimplemented extension must not be executable");
    }
  }

  return { valid: errors.length === 0, errors };
}

async function main() {
  const errors = [];
  const standard = readJson(STANDARD_PATH);
  const template = readJson(TEMPLATE_PATH);

  if (standard.object_type !== "INVOCORDER_CAPABILITY_MANIFEST_HOSTILE_FIXTURE_STANDARD") errors.push("bad standard object_type");
  if (standard.schema_version !== "1.4.0") errors.push("bad standard schema_version");
  if (template.schema_version !== "1.2.0") errors.push("bad manifest template schema_version");

  let sourceRuntimeAssets = [];
  try {
    const assets = await getReleaseAssets(standard.source_runtime_release_tag);
    const wanted = [
      "INVOCORDER_CAPABILITY_RUNTIME_ENFORCEMENT_STANDARD.json",
      "INVOCORDER_CAPABILITY_RUNTIME_ENFORCEMENT_RECEIPT.json"
    ];
    for (const name of wanted) {
      const a = assets.find(x => x.name === name);
      if (!a) {
        errors.push(`missing source v1.3 release asset: ${name}`);
        continue;
      }
      sourceRuntimeAssets.push(await downloadAsset(a));
    }
  } catch (e) {
    errors.push(String(e.message || e));
  }

  const runtimeReceipt = sourceRuntimeAssets.find(a => a.name === "INVOCORDER_CAPABILITY_RUNTIME_ENFORCEMENT_RECEIPT.json");
  const runtimeStandard = sourceRuntimeAssets.find(a => a.name === "INVOCORDER_CAPABILITY_RUNTIME_ENFORCEMENT_STANDARD.json");
  if (runtimeReceipt?.object_type !== "INVOCORDER_CAPABILITY_RUNTIME_ENFORCEMENT_RECEIPT") errors.push("bad source v1.3 runtime receipt object_type");
  if (runtimeReceipt?.schema_version !== "1.3.0") errors.push("bad source v1.3 runtime receipt schema_version");
  if (runtimeReceipt?.valid !== true) errors.push("source v1.3 runtime receipt not valid");
  if (runtimeStandard?.schema_version !== "1.3.0") errors.push("bad source v1.3 runtime standard schema_version");

  const fixtureResults = [];
  for (const c of standard.fixture_cases) {
    const p = path.join(standard.fixture_directory, c.file);
    const manifest = readJson(p);
    const result = validateManifest(manifest, standard);
    const passedValidity = result.valid === c.expected_valid;
    const passedErrors = (c.expected_errors || []).every(expected =>
      result.errors.some(actual => actual.includes(expected))
    );
    const passed = passedValidity && passedErrors;
    if (!passed) {
      errors.push(`fixture failed expectation: ${c.file}`);
    }
    fixtureResults.push({
      file: c.file,
      expected_valid: c.expected_valid,
      actual_valid: result.valid,
      expected_errors: c.expected_errors,
      actual_errors: result.errors,
      manifest_sha256_canonical_json: sha256CanonicalJson(manifest),
      passed
    });
  }

  const receipt = {
    object_type: "INVOCORDER_CAPABILITY_MANIFEST_HOSTILE_FIXTURE_RECEIPT",
    schema_version: "1.4.0",
    jurisdiction: "INVOCORDER",
    valid: errors.length === 0,
    errors,
    standard_path: STANDARD_PATH,
    standard_sha256_canonical_json: sha256CanonicalJson(standard),
    manifest_template_path: TEMPLATE_PATH,
    manifest_template_sha256_canonical_json: sha256CanonicalJson(template),
    source_repository: REPO,
    source_runtime_release_tag: standard.source_runtime_release_tag,
    consumed_source_runtime_release_assets: sourceRuntimeAssets.map(a => ({
      name: a.name,
      size_bytes: a.size_bytes,
      sha256: a.sha256,
      sha256_canonical_json: a.sha256_canonical_json,
      object_type: a.object_type,
      schema_version: a.schema_version,
      valid: a.valid
    })),
    fixture_case_count: fixtureResults.length,
    fixture_passed_count: fixtureResults.filter(r => r.passed).length,
    fixture_results: fixtureResults,
    hostile_cases_rejected: fixtureResults.filter(r => !r.expected_valid && r.actual_valid === false && r.passed).length,
    valid_cases_admitted: fixtureResults.filter(r => r.expected_valid && r.actual_valid === true && r.passed).length,
    local_working_tree_required_for_source_runtime_enforcement: false,
    private_source_required: false,
    public_release_asset_download_required_for_source_runtime_enforcement: true,
    proves_capability_manifest_hostile_fixture_execution: errors.length === 0,
    proves_v1_3_runtime_enforcement_release_consumed: !!runtimeReceipt && runtimeReceipt.valid === true,
    proves_valid_capability_manifests_admitted: fixtureResults.some(r => r.expected_valid && r.passed),
    proves_truth_overclaim_rejected: fixtureResults.some(r => r.file === "truth-overclaim.json" && r.passed),
    proves_authorization_overclaim_rejected: fixtureResults.some(r => r.file === "authorization-overclaim.json" && r.passed),
    proves_unimplemented_capability_overclaim_rejected: fixtureResults.some(r => r.file === "unimplemented-capability-overclaim.json" && r.passed),
    proves_unsupervised_execution_overclaim_rejected: fixtureResults.some(r => r.file === "unsupervised-execution-overclaim.json" && r.passed),
    proves_implicit_network_capability_rejected: fixtureResults.some(r => r.file === "implicit-network-capability.json" && r.passed),
    proves_implicit_secret_access_rejected: fixtureResults.some(r => r.file === "implicit-secret-access.json" && r.passed),
    proves_unhashed_source_rejected: fixtureResults.some(r => r.file === "unhashed-source-external-release.json" && r.passed),
    proves_unmanifested_runtime_execution_rejected: fixtureResults.some(r => r.file === "unmanifested-runtime-execution.json" && r.passed),
    proves_external_release_without_assets_rejected: fixtureResults.some(r => r.file === "external-release-without-assets.json" && r.passed),
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
}

main().catch(e => {
  const receipt = {
    object_type: "INVOCORDER_CAPABILITY_MANIFEST_HOSTILE_FIXTURE_RECEIPT",
    schema_version: "1.4.0",
    jurisdiction: "INVOCORDER",
    valid: false,
    errors: [String(e.stack || e.message || e)],
    proves_truth: false,
    proves_authorization: false,
    proves_safety: false,
    proves_admissibility: false,
    proves_external_reality: false
  };
  fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify(receipt, null, 2));
  process.exit(1);
});
