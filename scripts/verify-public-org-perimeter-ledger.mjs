#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";

const errors = [];

function fail(msg) {
  errors.push(msg);
}

function run(cmd, args) {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function ghJson(path) {
  return JSON.parse(run("gh", ["api", path]));
}

function sha256CanonicalJson(obj) {
  return createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) fail(`${label}: expected ${expected}; got ${actual}`);
}

function requireFalse(value, label) {
  if (value !== false) fail(`${label} must be false`);
}

let result;

try {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const standard = JSON.parse(fs.readFileSync("ORG_PERIMETER/PUBLIC_ORG_PERIMETER_STANDARD.json", "utf8"));
  const ledger = JSON.parse(fs.readFileSync("ORG_PERIMETER/INVOCORDER_PUBLIC_ORG_PERIMETER_LEDGER.json", "utf8"));

  requireEqual(pkg.version, "0.4.0", "package version");
  requireEqual(standard.object_type, "INVOCORDER_PUBLIC_ORG_PERIMETER_STANDARD", "standard object_type");
  requireEqual(ledger.object_type, "INVOCORDER_PUBLIC_ORG_PERIMETER_LEDGER", "ledger object_type");
  requireEqual(ledger.schema_version, "0.4.0", "ledger schema_version");
  requireEqual(ledger.package_name, "@invocorder/recorder", "package_name");
  requireEqual(ledger.package_version, pkg.version, "ledger package_version");

  for (const key of ["proves_truth", "proves_authorization", "proves_safety", "proves_admissibility", "proves_external_reality"]) {
    requireFalse(standard.non_claims[key], `standard.non_claims.${key}`);
    requireFalse(ledger.non_claims[key], `ledger.non_claims.${key}`);
    requireFalse(ledger[key], `ledger.${key}`);
  }

  const requiredRepos = new Set(standard.required_repositories);
  const ledgerRepos = new Set(ledger.components.map(c => c.repository_full_name));

  for (const repo of requiredRepos) {
    if (!ledgerRepos.has(repo)) fail(`missing ledger component: ${repo}`);
  }

  for (const component of ledger.components) {
    const repo = ghJson(`/repos/${component.repository_full_name}`);
    requireEqual(repo.visibility, "public", `${component.repository_full_name} visibility`);
    requireEqual(repo.archived, false, `${component.repository_full_name} archived`);
    requireEqual(repo.default_branch, "main", `${component.repository_full_name} default_branch`);

    const isSelfRepository = component.repository_full_name === "INVOCORDER/INVOCORDER";

    if (isSelfRepository) {
      const localHead = run("git", ["rev-parse", "HEAD"]);
      try {
        run("git", ["merge-base", "--is-ancestor", component.default_branch_head_sha, localHead]);
      } catch {
        fail(`${component.repository_full_name} recorded default_branch_head_sha is not an ancestor of local verification HEAD`);
      }
    } else {
      const branch = ghJson(`/repos/${component.repository_full_name}/branches/${repo.default_branch}`);
      requireEqual(branch.commit.sha, component.default_branch_head_sha, `${component.repository_full_name} default_branch_head_sha`);
    }

    for (const entry of component.required_paths) {
      if (isSelfRepository) {
        if (!fs.existsSync(entry.path)) fail(`${component.repository_full_name}:${entry.path} missing from local checkout`);
      } else {
        ghJson(`/repos/${component.repository_full_name}/contents/${encodeURIComponent(entry.path).replaceAll("%2F", "/")}?ref=${repo.default_branch}`);
      }
      requireEqual(entry.exists, true, `${component.repository_full_name}:${entry.path} exists flag`);
    }
  }

  result = {
    object_type: "INVOCORDER_PUBLIC_ORG_PERIMETER_VERIFICATION_RESULT",
    schema_version: "0.4.0",
    valid: errors.length === 0,
    errors,
    ledger_path: "ORG_PERIMETER/INVOCORDER_PUBLIC_ORG_PERIMETER_LEDGER.json",
    ledger_sha256_canonical_json: sha256CanonicalJson(ledger),
    standard_path: "ORG_PERIMETER/PUBLIC_ORG_PERIMETER_STANDARD.json",
    standard_sha256_canonical_json: sha256CanonicalJson(standard),
    component_count: ledger.components.length,
    repositories_verified: ledger.components.map(c => c.repository_full_name),
    proves_public_org_perimeter: errors.length === 0,
    proves_component_repos_public: errors.length === 0,
    proves_component_roles_machine_readable: errors.length === 0,
    proves_required_component_files_exist: errors.length === 0,
    proves_non_claim_boundary_preserved: errors.length === 0,
    proves_truth: false,
    proves_authorization: false,
    proves_safety: false,
    proves_admissibility: false,
    proves_external_reality: false
  };
} catch (e) {
  result = {
    object_type: "INVOCORDER_PUBLIC_ORG_PERIMETER_VERIFICATION_RESULT",
    schema_version: "0.4.0",
    valid: false,
    errors: [String(e?.message || e)],
    proves_public_org_perimeter: false,
    proves_component_repos_public: false,
    proves_component_roles_machine_readable: false,
    proves_required_component_files_exist: false,
    proves_non_claim_boundary_preserved: false,
    proves_truth: false,
    proves_authorization: false,
    proves_safety: false,
    proves_admissibility: false,
    proves_external_reality: false
  };
}

console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exit(1);
