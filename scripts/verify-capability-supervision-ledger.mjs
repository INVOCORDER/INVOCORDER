#!/usr/bin/env node
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");
const cp = require("node:child_process");

const STANDARD_PATH = "CAPABILITY_SUPERVISION/INVOCORDER_CAPABILITY_SUPERVISION_STANDARD.json";
const LEDGER_PATH = "CAPABILITY_SUPERVISION/INVOCORDER_CAPABILITY_SUPERVISION_LEDGER.json";
const SOURCE_CHAIN_RECEIPT = "AUDIT/INVOCORDER_PUBLIC_AUDIT_CHAIN_CLOSURE_RECEIPT.json";
const SOURCE_CHAIN_RELEASE_TAG = "v1.0.0-public-audit-chain-closure";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonicalize(value[k])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256Buffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function sha256File(p) {
  return sha256Buffer(fs.readFileSync(p));
}

function sha256CanonicalJson(value) {
  return sha256Buffer(Buffer.from(canonicalJson(value)));
}

function exists(p) {
  return fs.existsSync(p);
}

function statMode(p) {
  const st = fs.statSync(p);
  return {
    size_bytes: st.size,
    executable: Boolean(st.mode & 0o111)
  };
}

function walk(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  function rec(p) {
    const base = path.basename(p);
    if (base === ".git" || base === "node_modules" || base === ".invocorder") return;
    if (p === LEDGER_PATH) return;

    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const ent of fs.readdirSync(p).sort()) rec(path.join(p, ent));
    } else if (st.isFile()) {
      out.push(p.replaceAll("\\", "/"));
    }
  }
  rec(root);
  return out.sort();
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

function familyForFile(file) {
  if (file.startsWith("bin/")) return "cli";
  if (file.startsWith("src/capture/")) return "capture";
  if (file.startsWith("src/process/")) return "process";
  if (file.startsWith("src/effects/")) return "effects";
  if (file.startsWith("src/hash/")) return "hash_chain";
  if (file.startsWith("src/bundle/")) return "bundle_replay";
  if (file.startsWith("src/omission/")) return "omission";
  if (file.startsWith("src/redaction/")) return "redaction";
  if (file.startsWith("src/mcp/")) return "mcp_boundary";
  if (file.startsWith("src/fixtures/")) return "fixture_execution";
  if (file.startsWith("src/signing/")) return "signing";
  if (file.startsWith("scripts/verify-public") || file.startsWith("AUDIT/")) return "release_auditing";
  if (file.startsWith(".github/workflows/")) return "workflow_ci";
  if (file.startsWith("docs/") || file === "README.md") return "documentation";
  if (file.startsWith("schemas/")) return "schema_boundary";
  if (file.startsWith("ORG_PERIMETER/")) return "integration_boundary";
  if (file.startsWith("CAPABILITY_SUPERVISION/")) return "supervision_boundary";
  if (file.startsWith("FIXTURE_CONSUMPTION/") || file.startsWith("FIXTURE_EXECUTION/")) return "fixture_execution";
  if (file.startsWith("RELEASE_CONSUMPTION/")) return "release_auditing";
  return "core";
}

function collectFiles(roots) {
  const unique = new Set();
  for (const root of roots) {
    if (root === "CAPABILITY_SUPERVISION") {
      for (const p of walk(root)) if (p !== LEDGER_PATH) unique.add(p);
    } else {
      for (const p of walk(root)) unique.add(p);
    }
  }

  for (const p of [
    "package.json",
    "package-lock.json",
    "VERSION",
    "README.md",
    "SECURITY.md",
    "THREAT_MODEL.md",
    "NON_GOALS.md",
    "PUBLISH_DECISION.md",
    "ROADMAP.md",
    "LICENSE",
    "COMMERCIAL-LICENSE.md",
    "COPYING-AGPL-3.0.md"
  ]) {
    if (exists(p)) unique.add(p);
  }

  return [...unique].sort().map(file => {
    const m = statMode(file);
    return {
      path: file,
      family: familyForFile(file),
      size_bytes: m.size_bytes,
      executable: m.executable,
      sha256: sha256File(file)
    };
  });
}

function countBy(items, key) {
  const out = {};
  for (const item of items) out[item[key]] = (out[item[key]] || 0) + 1;
  return Object.fromEntries(Object.entries(out).sort());
}

function assertNoForbiddenClaims(obj, label, errors) {
  const forbidden = [
    "claims_truth",
    "claims_authorization",
    "claims_safety",
    "claims_admissibility",
    "claims_external_reality",
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

function ghReleaseAssets(tag) {
  const r = safeRun("gh", ["release", "view", tag, "--json", "assets,tagName,url,publishedAt,name"]);
  if (!r.ok) {
    return { ok: false, error: r.stderr || r.stdout };
  }
  return { ok: true, release: JSON.parse(r.stdout) };
}

function downloadReleaseAsset(tag, name, tmp) {
  run("gh", ["release", "download", tag, "-p", name, "-D", tmp, "--clobber"]);
  return path.join(tmp, name);
}

function rootCoverage(files, root) {
  if (root === "CAPABILITY_SUPERVISION") {
    return files.filter(f => f.path.startsWith(`${root}/`) && f.path !== LEDGER_PATH).length;
  }
  return files.filter(f => f.path.startsWith(`${root}/`)).length;
}

const errors = [];
const pkg = readJson("package.json");
const standard = readJson(STANDARD_PATH);
const sourceChain = readJson(SOURCE_CHAIN_RECEIPT);
if (standard.object_type !== "INVOCORDER_CAPABILITY_SUPERVISION_STANDARD") errors.push("bad standard object_type");
if (standard.schema_version !== "1.1.0") errors.push("bad standard schema_version");
if (sourceChain.object_type !== "INVOCORDER_PUBLIC_AUDIT_CHAIN_CLOSURE_RECEIPT") errors.push("bad source chain receipt object_type");
if (sourceChain.schema_version !== "1.0.0") errors.push("bad source chain schema_version");
if (sourceChain.valid !== true) errors.push("source chain closure receipt is not valid");

assertNoForbiddenClaims(standard, "standard", errors);
assertNoForbiddenClaims(sourceChain, "source_chain", errors);

for (const node of standard.required_past_chain_nodes.filter(n => n !== SOURCE_CHAIN_RELEASE_TAG)) {
  if (!sourceChain.audited_chain_nodes?.includes(node)) errors.push(`source chain missing audited node: ${node}`);
}

const files = collectFiles(standard.required_present_surface_roots);

const root_coverage = {};
for (const root of standard.required_present_surface_roots) {
  root_coverage[root] = rootCoverage(files, root);
  if (root !== "schemas" && root_coverage[root] < 1) {
    errors.push(`required present surface root empty or missing: ${root}`);
  }
}

const family_counts = countBy(files, "family");
for (const fam of [
  "cli",
  "capture",
  "process",
  "effects",
  "hash_chain",
  "bundle_replay",
  "omission",
  "redaction",
  "mcp_boundary",
  "fixture_execution",
  "signing",
  "release_auditing",
  "workflow_ci",
  "documentation",
  "supervision_boundary"
]) {
  if (!family_counts[fam]) errors.push(`capability family has no bound files: ${fam}`);
}

const pkg_bin = pkg.bin || {};
const package_scripts = pkg.scripts || {};
for (const [name, rel] of Object.entries(pkg_bin)) {
  if (!exists(rel)) errors.push(`package bin missing: ${name} -> ${rel}`);
}

const sourceModuleRoots = exists("src")
  ? fs.readdirSync("src").filter(x => fs.statSync(path.join("src", x)).isDirectory()).sort()
  : [];

const workflows = files.filter(f => f.path.startsWith(".github/workflows/")).map(f => f.path);
const verifyScripts = files.filter(f => f.path.startsWith("scripts/verify-")).map(f => f.path);

const release = ghReleaseAssets(SOURCE_CHAIN_RELEASE_TAG);
let v1_0_release_assets = [];
let downloaded_v1_0_assets = [];

if (!release.ok) {
  errors.push(`cannot read v1.0 release assets: ${release.error}`);
} else {
  v1_0_release_assets = release.release.assets.map(a => ({
    name: a.name,
    size_bytes: a.size,
    url: a.url
  })).sort((a, b) => a.name.localeCompare(b.name));

  for (const requiredAsset of [
    "PUBLIC_AUDIT_CHAIN_CLOSURE_STANDARD.json",
    "INVOCORDER_PUBLIC_AUDIT_CHAIN_CLOSURE_RECEIPT.json"
  ]) {
    if (!v1_0_release_assets.some(a => a.name === requiredAsset)) {
      errors.push(`v1.0 release missing asset: ${requiredAsset}`);
    }
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "invocorder-v110-v100-assets-"));
  for (const asset of [
    "PUBLIC_AUDIT_CHAIN_CLOSURE_STANDARD.json",
    "INVOCORDER_PUBLIC_AUDIT_CHAIN_CLOSURE_RECEIPT.json"
  ]) {
    try {
      const p = downloadReleaseAsset(SOURCE_CHAIN_RELEASE_TAG, asset, tmp);
      const parsed = readJson(p);
      downloaded_v1_0_assets.push({
        name: asset,
        size_bytes: fs.statSync(p).size,
        sha256: sha256File(p),
        sha256_canonical_json: sha256CanonicalJson(parsed),
        object_type: parsed.object_type,
        schema_version: parsed.schema_version,
        valid: parsed.valid ?? null
      });
      assertNoForbiddenClaims(parsed, `downloaded_v1_0_asset.${asset}`, errors);
    } catch (e) {
      errors.push(`cannot download/verify v1.0 release asset ${asset}: ${e.message}`);
    }
  }
}

const expectedFutureSlots = [
  "plugin_adapters",
  "external_tool_runners",
  "policy_engines",
  "evidence_schema_expansion",
  "hostile_fixture_expansion",
  "release_auditor_expansion"
];

const futureSlots = standard.future_extension_slots || [];
for (const slot of expectedFutureSlots) {
  const found = futureSlots.find(x => x.slot === slot);
  if (!found) errors.push(`missing future extension slot: ${slot}`);
  if (found && found.status !== "declared_extension_boundary_not_claimed_as_implemented") {
    errors.push(`future slot overclaims implementation: ${slot}`);
  }
}

const ledger = {
  object_type: "INVOCORDER_CAPABILITY_SUPERVISION_LEDGER",
  schema_version: "1.1.0",
  jurisdiction: "INVOCORDER",
  valid: errors.length === 0,
  errors,
  standard_path: STANDARD_PATH,
  standard_sha256_canonical_json: sha256CanonicalJson(standard),
  source_repository: "INVOCORDER/INVOCORDER",
  package_name: pkg.name,
  package_version: "1.1.0",
  source_chain_receipt_path: SOURCE_CHAIN_RECEIPT,
  source_chain_receipt_sha256_canonical_json: sha256CanonicalJson(sourceChain),
  audited_past_chain_nodes: standard.required_past_chain_nodes,
  source_chain_audited_public_artifact_count: sourceChain.audited_public_artifact_count,
  source_v1_0_release_tag: SOURCE_CHAIN_RELEASE_TAG,
  source_v1_0_release_assets: v1_0_release_assets,
  downloaded_v1_0_release_assets: downloaded_v1_0_assets,
  present_surface_root_coverage: root_coverage,
  present_first_party_file_count: files.length,
  capability_family_counts: family_counts,
  package_bin: pkg_bin,
  package_scripts,
  dependency_names: Object.keys(pkg.dependencies || {}).sort(),
  dev_dependency_names: Object.keys(pkg.devDependencies || {}).sort(),
  source_module_roots: sourceModuleRoots,
  workflow_count: workflows.length,
  workflows,
  verifier_script_count: verifyScripts.length,
  verifier_scripts: verifyScripts,
  first_party_files: files,
  future_extension_slots: futureSlots,
  local_working_tree_required_for_supervision: false,
  private_source_required: false,
  public_release_asset_download_required_for_past_closure: true,
  proves_capability_supervision_plane: errors.length === 0,
  proves_past_public_audit_chain_bound: errors.length === 0,
  proves_present_first_party_capability_surface_bound: errors.length === 0,
  proves_future_extension_slots_declared_without_implementation_overclaim: errors.length === 0,
  proves_v1_0_public_closure_release_assets_bound: errors.length === 0,
  proves_cli_surface_bound: errors.length === 0,
  proves_workflow_surface_bound: errors.length === 0,
  proves_verifier_surface_bound: errors.length === 0,
  proves_non_claim_boundary_preserved: errors.length === 0,
  proves_truth: false,
  proves_authorization: false,
  proves_safety: false,
  proves_admissibility: false,
  proves_external_reality: false
};

assertNoForbiddenClaims(ledger, "ledger", errors);
ledger.valid = errors.length === 0;
ledger.errors = errors;
ledger.proves_capability_supervision_plane = ledger.valid;
ledger.proves_past_public_audit_chain_bound = ledger.valid;
ledger.proves_present_first_party_capability_surface_bound = ledger.valid;
ledger.proves_future_extension_slots_declared_without_implementation_overclaim = ledger.valid;
ledger.proves_v1_0_public_closure_release_assets_bound = ledger.valid;
ledger.proves_cli_surface_bound = ledger.valid;
ledger.proves_workflow_surface_bound = ledger.valid;
ledger.proves_verifier_surface_bound = ledger.valid;
ledger.proves_non_claim_boundary_preserved = ledger.valid;

fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + "\n");
console.log(JSON.stringify(ledger, null, 2));

if (!ledger.valid) process.exit(1);
