#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const standardPath = "FIXTURE_CONSUMPTION/PUBLIC_HOSTILE_FIXTURE_CONSUMPTION_STANDARD.json";
const receiptPath = "FIXTURE_CONSUMPTION/INVOCORDER_PUBLIC_HOSTILE_FIXTURE_CONSUMPTION_RECEIPT.json";
const writeReceipt = process.argv.includes("--write-receipt");

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
  return createHash("sha256").update(buf).digest("hex");
}

function sha256Text(text) {
  return sha256Buffer(Buffer.from(text));
}

function sha256CanonicalJson(value) {
  return sha256Text(canonicalJson(value));
}

function runGhApi(path) {
  return execFileSync("gh", ["api", path], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_ENTERPRISE_TOKEN || ""
    }
  });
}

function ghJson(path) {
  return JSON.parse(runGhApi(path));
}

function assert(errors, condition, message) {
  if (!condition) errors.push(message);
}

function loadStandard() {
  return JSON.parse(readFileSync(standardPath, "utf8"));
}

function getCommitAndTree(repository, commitSha) {
  const commit = ghJson(`/repos/${repository}/git/commits/${commitSha}`);
  const tree = ghJson(`/repos/${repository}/git/trees/${commit.tree.sha}?recursive=1`);
  return { commit, tree };
}

function readBlob(repository, blobSha) {
  const blob = ghJson(`/repos/${repository}/git/blobs/${blobSha}`);
  const raw = String(blob.content || "").replace(/\n/g, "");
  if (blob.encoding !== "base64") {
    throw new Error(`unsupported blob encoding for ${blobSha}: ${blob.encoding}`);
  }
  return Buffer.from(raw, "base64");
}

function isConsumedPath(path, standard) {
  if (standard.required_source_files.includes(path)) return true;
  return standard.required_fixture_roots.some(root => path.startsWith(`${root}/`));
}

function familyFromPath(path) {
  if (path.startsWith("fixtures/mcp/")) return "mcp";
  if (path.startsWith("fixtures/signed-bundles/")) return "signed-bundles";
  return "source";
}

function fixtureCaseNames(files, root) {
  const prefix = `${root}/`;
  return [...new Set(
    files
      .map(f => f.path)
      .filter(p => p.startsWith(prefix))
      .map(p => p.slice(prefix.length).split("/")[0])
      .filter(x => x && x !== "README.md" && x !== "INDEX.json")
  )].sort();
}

function generateReceipt() {
  const standard = loadStandard();
  const repo = ghJson(`/repos/${standard.source_repository}`);
  const branch = ghJson(`/repos/${standard.source_repository}/branches/${repo.default_branch}`);
  const headSha = branch.commit.sha;
  const { tree } = getCommitAndTree(standard.source_repository, headSha);

  const blobEntries = tree.tree
    .filter(e => e.type === "blob")
    .filter(e => isConsumedPath(e.path, standard))
    .sort((a, b) => a.path.localeCompare(b.path));

  const consumedFiles = blobEntries.map(entry => {
    const content = readBlob(standard.source_repository, entry.sha);
    return {
      path: entry.path,
      family: familyFromPath(entry.path),
      git_blob_sha: entry.sha,
      size_bytes: Number(entry.size ?? content.length),
      sha256: sha256Buffer(content)
    };
  });

  const fileMap = new Map(consumedFiles.map(f => [f.path, f]));
  for (const required of standard.required_source_files) {
    if (!fileMap.has(required)) throw new Error(`required public fixture source file missing: ${required}`);
  }

  const mcpIndexBlob = readBlob(standard.source_repository, fileMap.get("fixtures/mcp/INDEX.json").git_blob_sha);
  const signedIndexBlob = readBlob(standard.source_repository, fileMap.get("fixtures/signed-bundles/INDEX.json").git_blob_sha);
  JSON.parse(mcpIndexBlob.toString("utf8"));
  JSON.parse(signedIndexBlob.toString("utf8"));

  const receipt = {
    object_type: "INVOCORDER_PUBLIC_HOSTILE_FIXTURE_CONSUMPTION_RECEIPT",
    schema_version: "0.5.0",
    jurisdiction: "INVOCORDER",
    valid: true,
    errors: [],
    generated_from: "live_public_github_api",
    source_repository: standard.source_repository,
    source_repository_private: Boolean(repo.private),
    source_default_branch: repo.default_branch,
    source_default_branch_head_sha: headSha,
    source_commit_url: `https://github.com/${standard.source_repository}/commit/${headSha}`,
    standard_path: standardPath,
    standard_sha256_canonical_json: sha256CanonicalJson(standard),
    consumed_file_count: consumedFiles.length,
    consumed_public_files: consumedFiles,
    consumed_fixture_families: standard.required_fixture_families,
    mcp_fixture_case_count: fixtureCaseNames(consumedFiles, "fixtures/mcp").length,
    signed_bundle_fixture_case_count: fixtureCaseNames(consumedFiles, "fixtures/signed-bundles").length,
    mcp_fixture_cases: fixtureCaseNames(consumedFiles, "fixtures/mcp"),
    signed_bundle_fixture_cases: fixtureCaseNames(consumedFiles, "fixtures/signed-bundles"),
    public_index_files_parsed: [
      "fixtures/mcp/INDEX.json",
      "fixtures/signed-bundles/INDEX.json"
    ],
    local_sibling_repository_required: false,
    private_source_required: false,
    network_required_to_acquire_public_fixtures: true,
    network_runtime_required_after_asset_acquisition: false,
    proves_public_hostile_fixtures_consumed: true,
    proves_public_fixture_files_hash_verified: true,
    proves_fixture_indices_parse: true,
    proves_local_sibling_fixture_repo_not_required: true,
    proves_private_source_not_required: true,
    proves_non_claim_boundary_preserved: true,
    proves_truth: false,
    proves_authorization: false,
    proves_safety: false,
    proves_admissibility: false,
    proves_external_reality: false
  };

  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
  return receipt;
}

function verifyReceipt(receipt) {
  const errors = [];
  const standard = loadStandard();

  assert(errors, standard.object_type === "INVOCORDER_PUBLIC_HOSTILE_FIXTURE_CONSUMPTION_STANDARD", "bad standard object_type");
  assert(errors, standard.schema_version === "0.5.0", "bad standard schema_version");
  assert(errors, receipt.object_type === "INVOCORDER_PUBLIC_HOSTILE_FIXTURE_CONSUMPTION_RECEIPT", "bad receipt object_type");
  assert(errors, receipt.schema_version === "0.5.0", "bad receipt schema_version");
  assert(errors, receipt.source_repository === standard.source_repository, "source repository mismatch");
  assert(errors, receipt.standard_sha256_canonical_json === sha256CanonicalJson(standard), "standard canonical sha mismatch");

  const repo = ghJson(`/repos/${standard.source_repository}`);
  assert(errors, repo.private === false, "source repository is not public");

  const { tree } = getCommitAndTree(standard.source_repository, receipt.source_default_branch_head_sha);
  const treeMap = new Map(tree.tree.filter(e => e.type === "blob").map(e => [e.path, e]));

  const consumed = Array.isArray(receipt.consumed_public_files) ? receipt.consumed_public_files : [];
  const consumedMap = new Map(consumed.map(f => [f.path, f]));

  for (const required of standard.required_source_files) {
    assert(errors, consumedMap.has(required), `required consumed file missing from receipt: ${required}`);
  }

  for (const root of standard.required_fixture_roots) {
    assert(errors, consumed.some(f => f.path.startsWith(`${root}/`)), `required fixture root has no consumed files: ${root}`);
  }

  for (const f of consumed) {
    const entry = treeMap.get(f.path);
    assert(errors, Boolean(entry), `consumed path absent from pinned public tree: ${f.path}`);
    if (!entry) continue;

    assert(errors, entry.sha === f.git_blob_sha, `git blob sha mismatch: ${f.path}`);
    const content = readBlob(standard.source_repository, entry.sha);
    assert(errors, sha256Buffer(content) === f.sha256, `sha256 mismatch: ${f.path}`);
    assert(errors, Number(f.size_bytes) === content.length, `size mismatch: ${f.path}`);
  }

  for (const indexPath of ["fixtures/mcp/INDEX.json", "fixtures/signed-bundles/INDEX.json"]) {
    const f = consumedMap.get(indexPath);
    if (!f) continue;
    try {
      JSON.parse(readBlob(standard.source_repository, f.git_blob_sha).toString("utf8"));
    } catch {
      errors.push(`fixture index is not parseable JSON: ${indexPath}`);
    }
  }

  assert(errors, receipt.source_repository_private === false, "receipt says source repository is private");
  assert(errors, receipt.local_sibling_repository_required === false, "local sibling repository required");
  assert(errors, receipt.private_source_required === false, "private source required");
  assert(errors, receipt.network_required_to_acquire_public_fixtures === true, "network acquisition boundary not named");
  assert(errors, receipt.network_runtime_required_after_asset_acquisition === false, "network runtime dependency after acquisition claimed");

  for (const k of ["proves_truth", "proves_authorization", "proves_safety", "proves_admissibility", "proves_external_reality"]) {
    assert(errors, receipt[k] === false, `non-claim boundary violated: ${k}`);
  }

  const result = {
    object_type: "INVOCORDER_PUBLIC_HOSTILE_FIXTURE_CONSUMPTION_VERIFICATION_RESULT",
    schema_version: "0.5.0",
    valid: errors.length === 0,
    errors,
    receipt_path: receiptPath,
    receipt_sha256_canonical_json: sha256CanonicalJson(receipt),
    standard_path: standardPath,
    standard_sha256_canonical_json: sha256CanonicalJson(standard),
    source_repository: receipt.source_repository,
    source_default_branch: receipt.source_default_branch,
    source_default_branch_head_sha: receipt.source_default_branch_head_sha,
    consumed_file_count: consumed.length,
    mcp_fixture_case_count: receipt.mcp_fixture_case_count,
    signed_bundle_fixture_case_count: receipt.signed_bundle_fixture_case_count,
    proves_public_hostile_fixtures_consumed: errors.length === 0,
    proves_public_fixture_files_hash_verified: errors.length === 0,
    proves_fixture_indices_parse: errors.length === 0,
    proves_local_sibling_fixture_repo_not_required: receipt.local_sibling_repository_required === false,
    proves_private_source_not_required: receipt.private_source_required === false,
    proves_non_claim_boundary_preserved: errors.length === 0,
    proves_truth: false,
    proves_authorization: false,
    proves_safety: false,
    proves_admissibility: false,
    proves_external_reality: false
  };

  return result;
}

let receipt;
if (writeReceipt) {
  receipt = generateReceipt();
} else {
  if (!existsSync(receiptPath)) {
    const result = {
      object_type: "INVOCORDER_PUBLIC_HOSTILE_FIXTURE_CONSUMPTION_VERIFICATION_RESULT",
      schema_version: "0.5.0",
      valid: false,
      errors: [`missing receipt: ${receiptPath}`],
      proves_truth: false,
      proves_authorization: false,
      proves_safety: false,
      proves_admissibility: false,
      proves_external_reality: false
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
}

const result = verifyReceipt(receipt);
console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exit(1);
