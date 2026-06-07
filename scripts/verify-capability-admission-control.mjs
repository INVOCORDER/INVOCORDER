#!/usr/bin/env node
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const cp = require("node:child_process");

const STANDARD_PATH = "CAPABILITY_ADMISSION/INVOCORDER_CAPABILITY_ADMISSION_STANDARD.json";
const TEMPLATE_PATH = "CAPABILITY_ADMISSION/CAPABILITY_MANIFEST_TEMPLATE.json";
const REGISTRY_PATH = "CAPABILITY_ADMISSION/INVOCORDER_CAPABILITY_ADMISSION_REGISTRY.json";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function canonicalize(v) {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.keys(v).sort().map(k => [k, canonicalize(v[k])]));
  }
  return v;
}

function canonicalJson(v) {
  return JSON.stringify(canonicalize(v));
}

function sha256Buffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function sha256File(p) {
  return sha256Buffer(fs.readFileSync(p));
}

function sha256CanonicalJson(v) {
  return sha256Buffer(Buffer.from(canonicalJson(v)));
}

function run(cmd, args, options = {}) {
  return cp.execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "",
      GITHUB_TOKEN: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ""
    },
    ...options
  });
}

function safeRun(cmd, args) {
  try {
    return { ok: true, stdout: run(cmd, args), stderr: "" };
  } catch (e) {
    return {
      ok: false,
      stdout: e.stdout?.toString() || "",
      stderr: e.stderr?.toString() || e.message
    };
  }
}

function assertNoForbiddenClaims(obj, label, errors) {
  const forbidden = [
    "claims_truth",
    "claims_authorization",
    "claims_safety",
    "claims_admissibility",
    "claims_external_reality",
    "claims_unimplemented_capability",
    "claims_unsupervised_execution",
    "proves_truth",
    "proves_authorization",
    "proves_safety",
    "proves_admissibility",
    "proves_external_reality"
  ];

  function rec(v, p) {
    if (Array.isArray(v)) return v.forEach((x, i) => rec(x, `${p}[${i}]`));
    if (!v || typeof v !== "object") return;

    for (const [k, val] of Object.entries(v)) {
      const here = p ? `${p}.${k}` : k;
      if (forbidden.includes(k) && val !== false) {
        errors.push(`${label}.${here}: forbidden overclaim must be false`);
      }
      rec(val, here);
    }
  }

  rec(obj, "");
}

function downloadReleaseAsset(tag, name, tmp) {
  run("gh", ["release", "download", tag, "-p", name, "-D", tmp, "--clobber"]);
  return path.join(tmp, name);
}

function validateManifestShape(manifest, requiredFields, allowedStatuses, errors, label) {
  for (const f of requiredFields) {
    if (!(f in manifest)) errors.push(`${label}: missing manifest field ${f}`);
  }

  if (!allowedStatuses.includes(manifest.implementation_status)) {
    errors.push(`${label}: invalid implementation_status ${manifest.implementation_status}`);
  }

  assertNoForbiddenClaims(manifest, label, errors);

  if (manifest.implementation_status === "declared_extension_boundary_not_implemented") {
    if (manifest.executable_surface?.has_executable_surface !== false) {
      errors.push(`${label}: unimplemented extension cannot expose executable surface`);
    }
    if ((manifest.source_files || []).length !== 0) {
      errors.push(`${label}: unimplemented extension cannot bind source files as implemented`);
    }
  }
}

function summarizeSupervisionLedger(ledger) {
  return {
    object_type: ledger.object_type,
    schema_version: ledger.schema_version,
    valid: ledger.valid,
    package_name: ledger.package_name,
    package_version: ledger.package_version,
    present_first_party_file_count: ledger.present_first_party_file_count,
    capability_family_counts: ledger.capability_family_counts,
    workflow_count: ledger.workflow_count,
    verifier_script_count: ledger.verifier_script_count,
    future_extension_slots: ledger.future_extension_slots,
    proves_capability_supervision_plane: ledger.proves_capability_supervision_plane,
    proves_present_first_party_capability_surface_bound: ledger.proves_present_first_party_capability_surface_bound,
    proves_future_extension_slots_declared_without_implementation_overclaim: ledger.proves_future_extension_slots_declared_without_implementation_overclaim,
    proves_truth: ledger.proves_truth,
    proves_authorization: ledger.proves_authorization,
    proves_safety: ledger.proves_safety,
    proves_admissibility: ledger.proves_admissibility,
    proves_external_reality: ledger.proves_external_reality
  };
}

const errors = [];
const pkg = readJson("package.json");
const standard = readJson(STANDARD_PATH);
const template = readJson(TEMPLATE_PATH);

if (pkg.version !== "1.2.0") errors.push(`package version: expected 1.2.0; got ${pkg.version}`);
if (standard.object_type !== "INVOCORDER_CAPABILITY_ADMISSION_STANDARD") errors.push("bad standard object_type");
if (standard.schema_version !== "1.2.0") errors.push("bad standard schema_version");
if (template.object_type !== "INVOCORDER_CAPABILITY_MANIFEST") errors.push("bad template object_type");
if (template.schema_version !== "1.2.0") errors.push("bad template schema_version");

assertNoForbiddenClaims(standard, "standard", errors);
validateManifestShape(
  template,
  standard.capability_manifest_required_fields || [],
  standard.allowed_implementation_statuses || [],
  errors,
  "template"
);

const sourceTag = standard.source_supervision_release_tag;
const requiredAssets = standard.source_supervision_required_assets || [];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "invocorder-v120-source-supervision-"));

const releaseView = safeRun("gh", ["release", "view", sourceTag, "--json", "tagName,name,url,publishedAt,assets"]);
let release = null;
let downloaded = [];

if (!releaseView.ok) {
  errors.push(`cannot read source supervision release ${sourceTag}: ${releaseView.stderr || releaseView.stdout}`);
} else {
  release = JSON.parse(releaseView.stdout);
  const names = new Set((release.assets || []).map(a => a.name));
  for (const asset of requiredAssets) {
    if (!names.has(asset)) errors.push(`source release missing asset: ${asset}`);
  }

  for (const asset of requiredAssets) {
    try {
      const p = downloadReleaseAsset(sourceTag, asset, tmp);
      const parsed = readJson(p);
      downloaded.push({
        name: asset,
        size_bytes: fs.statSync(p).size,
        sha256: sha256File(p),
        sha256_canonical_json: sha256CanonicalJson(parsed),
        object_type: parsed.object_type,
        schema_version: parsed.schema_version,
        valid: parsed.valid ?? null,
        parsed
      });
      assertNoForbiddenClaims(parsed, `source_asset.${asset}`, errors);
    } catch (e) {
      errors.push(`cannot download/parse source asset ${asset}: ${e.message}`);
    }
  }
}

const sourceSupervisionStandard = downloaded.find(x => x.name === "INVOCORDER_CAPABILITY_SUPERVISION_STANDARD.json")?.parsed;
const sourceSupervisionLedger = downloaded.find(x => x.name === "INVOCORDER_CAPABILITY_SUPERVISION_LEDGER.json")?.parsed;

if (!sourceSupervisionStandard) errors.push("missing parsed source supervision standard");
if (!sourceSupervisionLedger) errors.push("missing parsed source supervision ledger");

if (sourceSupervisionStandard) {
  if (sourceSupervisionStandard.object_type !== "INVOCORDER_CAPABILITY_SUPERVISION_STANDARD") {
    errors.push("source supervision standard object_type mismatch");
  }
  if (sourceSupervisionStandard.schema_version !== "1.1.0") {
    errors.push("source supervision standard schema_version mismatch");
  }
}

if (sourceSupervisionLedger) {
  if (sourceSupervisionLedger.object_type !== "INVOCORDER_CAPABILITY_SUPERVISION_LEDGER") {
    errors.push("source supervision ledger object_type mismatch");
  }
  if (sourceSupervisionLedger.schema_version !== "1.1.0") {
    errors.push("source supervision ledger schema_version mismatch");
  }
  if (sourceSupervisionLedger.valid !== true) {
    errors.push("source supervision ledger is not valid");
  }
  if (sourceSupervisionLedger.proves_capability_supervision_plane !== true) {
    errors.push("source supervision ledger does not prove capability supervision plane");
  }
  if (sourceSupervisionLedger.private_source_required !== false) {
    errors.push("source supervision ledger requires private source");
  }
}

const futureSlots = sourceSupervisionLedger?.future_extension_slots || [];
const admissionSlots = futureSlots.map(slot => ({
  slot: slot.slot,
  inherited_from_supervision_status: slot.status,
  admission_state: "closed_until_manifest_bound",
  unmanifested_execution_allowed: false,
  manifest_required: true
}));

for (const slot of admissionSlots) {
  if (slot.inherited_from_supervision_status !== "declared_extension_boundary_not_claimed_as_implemented") {
    errors.push(`source future slot has unsafe inherited status: ${slot.slot}`);
  }
}

const manifestSchema = {
  object_type: "INVOCORDER_CAPABILITY_MANIFEST_SCHEMA_SUMMARY",
  schema_version: "1.2.0",
  required_fields: standard.capability_manifest_required_fields,
  allowed_implementation_statuses: standard.allowed_implementation_statuses,
  future_slot_policy: standard.future_slot_policy,
  required_non_claim_boundary: standard.required_non_claim_boundary
};

const firstPartyFamilies = Object.entries(sourceSupervisionLedger?.capability_family_counts || {})
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([family, count]) => ({
    family,
    inherited_from_v1_1_supervision: true,
    file_count: count,
    admission_state: "first_party_present_bound_by_v1_1_supervision",
    new_execution_granted_by_v1_2: false
  }));

const registry = {
  object_type: "INVOCORDER_CAPABILITY_ADMISSION_REGISTRY",
  schema_version: "1.2.0",
  jurisdiction: "INVOCORDER",
  valid: errors.length === 0,
  errors,
  standard_path: STANDARD_PATH,
  standard_sha256_canonical_json: sha256CanonicalJson(standard),
  manifest_template_path: TEMPLATE_PATH,
  manifest_template_sha256_canonical_json: sha256CanonicalJson(template),
  source_repository: "INVOCORDER/INVOCORDER",
  package_name: pkg.name,
  package_version: pkg.version,
  source_supervision_release_tag: sourceTag,
  source_supervision_release_url: release?.url || null,
  consumed_source_supervision_release_assets: downloaded.map(({ parsed, ...rest }) => rest),
  source_supervision_summary: sourceSupervisionLedger ? summarizeSupervisionLedger(sourceSupervisionLedger) : null,
  admission_default: standard.admission_default,
  manifest_schema: manifestSchema,
  first_party_present_capability_families: firstPartyFamilies,
  future_extension_admission_slots: admissionSlots,
  admitted_external_manifest_count: 0,
  admitted_external_manifests: [],
  rejected_or_closed_slots_count: admissionSlots.length,
  unmanifested_execution_allowed: false,
  implicit_plugin_loading_allowed: false,
  implicit_addon_loading_allowed: false,
  implicit_external_runner_allowed: false,
  implicit_network_capability_allowed: false,
  implicit_secret_access_allowed: false,
  implicit_truth_claim_allowed: false,
  local_working_tree_required_for_admission_control: false,
  private_source_required: false,
  public_release_asset_download_required_for_source_supervision: true,
  proves_capability_admission_control: errors.length === 0,
  proves_v1_1_supervision_plane_consumed: errors.length === 0,
  proves_manifest_schema_bound: errors.length === 0,
  proves_future_slots_default_closed: errors.length === 0,
  proves_no_unmanifested_future_execution: errors.length === 0,
  proves_first_party_present_surface_inherited_from_v1_1: errors.length === 0,
  proves_non_claim_boundary_preserved: errors.length === 0,
  proves_truth: false,
  proves_authorization: false,
  proves_safety: false,
  proves_admissibility: false,
  proves_external_reality: false
};

assertNoForbiddenClaims(registry, "registry", errors);
registry.valid = errors.length === 0;
registry.errors = errors;
registry.proves_capability_admission_control = registry.valid;
registry.proves_v1_1_supervision_plane_consumed = registry.valid;
registry.proves_manifest_schema_bound = registry.valid;
registry.proves_future_slots_default_closed = registry.valid;
registry.proves_no_unmanifested_future_execution = registry.valid;
registry.proves_first_party_present_surface_inherited_from_v1_1 = registry.valid;
registry.proves_non_claim_boundary_preserved = registry.valid;

fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n");
console.log(JSON.stringify(registry, null, 2));

if (!registry.valid) process.exit(1);
