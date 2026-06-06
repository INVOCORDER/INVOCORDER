
// INVOCORDER_V1_0_GITHUB_AUTH_HTTP_PATCH
import { createRequire as __invocorderCreateRequire } from "node:module";
const __invocorderRequire = __invocorderCreateRequire(import.meta.url);
const __invocorderHttps = __invocorderRequire("node:https");
const __invocorderChildProcess = __invocorderRequire("node:child_process");

function __invocorderGithubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  try {
    const r = __invocorderChildProcess.spawnSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  } catch {}
  return "";
}

const __invocorderGithubAuthToken = __invocorderGithubToken();

function __invocorderUrlString(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (input && typeof input.href === "string") return input.href;
  if (input && typeof input.hostname === "string") {
    const protocol = input.protocol || "https:";
    const path = input.path || input.pathname || "/";
    return protocol + "//" + input.hostname + path;
  }
  return "";
}

function __invocorderHeadersObject(headers) {
  if (!headers) return {};
  if (typeof headers.forEach === "function") {
    const out = {};
    headers.forEach((v, k) => out[k] = v);
    return out;
  }
  return { ...headers };
}

function __invocorderGithubHeadersFor(input, options = {}) {
  const url = __invocorderUrlString(input);
  const headers = __invocorderHeadersObject(options.headers);
  const isGithub =
    url.startsWith("https://api.github.com/") ||
    url.startsWith("https://github.com/") ||
    url.startsWith("https://raw.githubusercontent.com/") ||
    url.startsWith("https://objects.githubusercontent.com/");

  if (isGithub) {
    headers["User-Agent"] = headers["User-Agent"] || "INVOCORDER-public-audit-chain-closure/1.0";
    headers["Accept"] = headers["Accept"] || "application/vnd.github+json, application/octet-stream";
    if (__invocorderGithubAuthToken && !headers["Authorization"]) {
      headers["Authorization"] = "Bearer " + __invocorderGithubAuthToken;
    }
  }

  return { ...options, headers };
}

function __invocorderPatchHttpsArgs(argsLike) {
  const args = Array.from(argsLike);
  if (typeof args[1] === "function" || args.length === 1) {
    args.splice(1, 0, __invocorderGithubHeadersFor(args[0], {}));
  } else {
    args[1] = __invocorderGithubHeadersFor(args[0], args[1] || {});
  }
  return args;
}

const __invocorderOriginalHttpsGet = __invocorderHttps.get;
const __invocorderOriginalHttpsRequest = __invocorderHttps.request;

__invocorderHttps.get = function patchedGithubHttpsGet(...args) {
  return __invocorderOriginalHttpsGet.apply(this, __invocorderPatchHttpsArgs(args));
};

__invocorderHttps.request = function patchedGithubHttpsRequest(...args) {
  return __invocorderOriginalHttpsRequest.apply(this, __invocorderPatchHttpsArgs(args));
};

if (typeof globalThis.fetch === "function") {
  const __invocorderOriginalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = function patchedGithubFetch(input, init = {}) {
    return __invocorderOriginalFetch(input, __invocorderGithubHeadersFor(input, init));
  };
}
// /INVOCORDER_V1_0_GITHUB_AUTH_HTTP_PATCH

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const STANDARD_PATH = "AUDIT/PUBLIC_AUDIT_CHAIN_CLOSURE_STANDARD.json";
const RECEIPT_PATH = "AUDIT/INVOCORDER_PUBLIC_AUDIT_CHAIN_CLOSURE_RECEIPT.json";

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

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function sha256CanonicalJson(obj) {
  return sha256(Buffer.from(canonicalJson(obj)));
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function requireEqual(actual, expected, label, errors) {
  if (actual !== expected) errors.push(`${label}: expected ${expected}; got ${actual}`);
}

function requireTrue(actual, label, errors) {
  if (actual !== true) errors.push(`${label}: expected true; got ${actual}`);
}

function requireFalse(actual, label, errors) {
  if (actual !== false) errors.push(`${label}: expected false; got ${actual}`);
}

function headers() {
  const h = {
    "User-Agent": "invocorder-v100-public-audit-chain-closure",
    "Accept": "application/vnd.github+json"
  };
  if (process.env.GH_TOKEN) h.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  if (process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

function getBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: headers() }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        getBuffer(res.headers.location).then(resolve, reject);
        return;
      }
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        const body = Buffer.concat(chunks);
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`GET ${url} -> ${res.statusCode}: ${body.toString("utf8", 0, 800)}`));
          return;
        }
        resolve(body);
      });
    }).on("error", reject);
  });
}

async function getJson(url) {
  const buf = await getBuffer(url);
  return JSON.parse(buf.toString("utf8"));
}

async function fetchRepoFile(repo, ref, filePath) {
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(filePath).replaceAll("%2F", "/")}?ref=${encodeURIComponent(ref)}`;
  const meta = await getJson(url);
  const raw = Buffer.from(String(meta.content || "").replace(/\n/g, ""), "base64");
  return {
    source_kind: "repository_file_at_tag",
    path: filePath,
    ref,
    git_blob_sha: meta.sha,
    bytes: raw
  };
}

async function fetchReleaseAsset(repo, tag, name) {
  const release = await getJson(`https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`);
  const asset = (release.assets || []).find(a => a.name === name);
  if (!asset) throw new Error(`missing release asset ${tag}/${name}`);
  const raw = await getBuffer(asset.browser_download_url);
  return {
    source_kind: "release_asset",
    tag,
    release_url: release.html_url,
    name,
    browser_download_url: asset.browser_download_url,
    bytes: raw
  };
}

function summarizeArtifact(raw, expected) {
  const entry = {
    source_kind: raw.source_kind,
    name: expected.name,
    size_bytes: raw.bytes.length,
    sha256: sha256(raw.bytes),
    expected_sha256: expected.expected_sha256 || null
  };

  if (raw.path) entry.path = raw.path;
  if (raw.ref) entry.ref = raw.ref;
  if (raw.git_blob_sha) {
    entry.git_blob_sha = raw.git_blob_sha;
    entry.expected_git_blob_sha = expected.expected_git_blob_sha || null;
  }
  if (raw.tag) entry.tag = raw.tag;
  if (raw.release_url) entry.release_url = raw.release_url;
  if (raw.browser_download_url) entry.browser_download_url = raw.browser_download_url;

  if (expected.json === true) {
    const obj = JSON.parse(raw.bytes.toString("utf8"));
    entry.object_type = obj.object_type || null;
    entry.schema_version = obj.schema_version || null;
    entry.valid = typeof obj.valid === "boolean" ? obj.valid : null;
    entry.sha256_canonical_json = sha256CanonicalJson(obj);
    entry.expected_sha256_canonical_json = expected.expected_sha256_canonical_json || null;
    entry.claims_truth = obj.proves_truth === true || obj.claims_truth === true;
    entry.claims_authorization = obj.proves_authorization === true || obj.claims_authorization === true;
    entry.claims_safety = obj.proves_safety === true || obj.claims_safety === true;
    entry.claims_admissibility = obj.proves_admissibility === true || obj.claims_admissibility === true;
    entry.claims_external_reality = obj.proves_external_reality === true || obj.claims_external_reality === true;
  }

  return entry;
}

function validateArtifact(entry, expected, errors) {
  requireEqual(entry.sha256, expected.expected_sha256, `${expected.id} sha256`, errors);

  if (expected.expected_git_blob_sha) {
    requireEqual(entry.git_blob_sha, expected.expected_git_blob_sha, `${expected.id} git blob sha`, errors);
  }

  if (expected.json === true) {
    requireEqual(entry.sha256_canonical_json, expected.expected_sha256_canonical_json, `${expected.id} canonical json sha256`, errors);
    requireEqual(entry.object_type, expected.expected_object_type, `${expected.id} object_type`, errors);
    requireEqual(entry.schema_version, expected.expected_schema_version, `${expected.id} schema_version`, errors);

    if (expected.expect_valid === true) requireTrue(entry.valid, `${expected.id} valid`, errors);

    requireFalse(entry.claims_truth, `${expected.id} claims truth`, errors);
    requireFalse(entry.claims_authorization, `${expected.id} claims authorization`, errors);
    requireFalse(entry.claims_safety, `${expected.id} claims safety`, errors);
    requireFalse(entry.claims_admissibility, `${expected.id} claims admissibility`, errors);
    requireFalse(entry.claims_external_reality, `${expected.id} claims external reality`, errors);
  }
}

function extractJsonObjectByType(text, objectType) {
  const marker = `"object_type": "${objectType}"`;
  const idx = text.indexOf(marker);
  if (idx < 0) throw new Error(`could not find ${objectType} in runner stdout`);
  const start = text.lastIndexOf("{", idx);
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}") depth--;
    if (depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error("could not extract JSON object");
}

async function main() {
  const errors = [];
  const standard = readJson(STANDARD_PATH);

  requireEqual(standard.object_type, "INVOCORDER_PUBLIC_AUDIT_CHAIN_CLOSURE_STANDARD", "standard object_type", errors);
  requireEqual(standard.schema_version, "1.0.0", "standard schema_version", errors);
  requireFalse(standard.local_working_tree_required_for_audited_chain, "standard local_working_tree_required_for_audited_chain", errors);
  requireFalse(standard.private_source_required, "standard private_source_required", errors);

  const artifacts = [];

  for (const expected of standard.artifacts) {
    let raw;
    if (expected.source_kind === "repository_file_at_tag") {
      raw = await fetchRepoFile(standard.source_repository, expected.tag, expected.path);
    } else if (expected.source_kind === "release_asset") {
      raw = await fetchReleaseAsset(standard.source_repository, expected.tag, expected.name);
    } else {
      throw new Error(`unsupported source_kind ${expected.source_kind}`);
    }

    const entry = summarizeArtifact(raw, expected);
    validateArtifact(entry, expected, errors);
    artifacts.push(entry);
  }

  const byName = new Map(artifacts.map(a => [`${a.tag || a.ref}:${a.name || a.path}`, a]));

  const v09Receipt = byName.get("v0.9.0-public-auditor-runner-consumption-receipt:INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_CONSUMPTION_RECEIPT.json");
  if (v09Receipt) {
    requireTrue(v09Receipt.valid, "v0.9 public runner consumption receipt valid", errors);
  }

  const v08RunnerAsset = await fetchReleaseAsset(
    standard.source_repository,
    "v0.8.0-public-release-auditor-runner",
    "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER.mjs"
  );

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "invocorder-v100-chain-closure-"));
  const work = path.join(tmp, "clean-chain-auditor-work");
  const auditDir = path.join(work, "AUDIT");
  fs.mkdirSync(auditDir, { recursive: true });

  const runnerPath = path.join(auditDir, "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER.mjs");
  fs.writeFileSync(runnerPath, v08RunnerAsset.bytes);
  fs.chmodSync(runnerPath, 0o755);

  const v08Standard = await fetchReleaseAsset(
    standard.source_repository,
    "v0.8.0-public-release-auditor-runner",
    "PUBLIC_RELEASE_AUDITOR_RUNNER_STANDARD.json"
  );
  fs.writeFileSync(path.join(auditDir, "PUBLIC_RELEASE_AUDITOR_RUNNER_STANDARD.json"), v08Standard.bytes);

  const v08Receipt = await fetchReleaseAsset(
    standard.source_repository,
    "v0.8.0-public-release-auditor-runner",
    "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_RECEIPT.json"
  );
  fs.writeFileSync(path.join(auditDir, "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_RECEIPT.json"), v08Receipt.bytes);

  let runnerExitStatus = 0;
  let runnerStdout = "";
  let runnerReceipt = null;

  try {
    runnerStdout = execFileSync(process.execPath, [runnerPath], {
      cwd: work,
      env: {
        ...process.env,
        GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN || ""
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 180000,
      maxBuffer: 20 * 1024 * 1024
    });

    const generated = path.join(auditDir, "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_RECEIPT.json");
    if (fs.existsSync(generated)) {
      runnerReceipt = JSON.parse(fs.readFileSync(generated, "utf8"));
    } else {
      runnerReceipt = extractJsonObjectByType(runnerStdout, "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_RECEIPT");
    }
  } catch (err) {
    runnerExitStatus = typeof err.status === "number" ? err.status : 1;
    errors.push(`v0.8 runner execution failed: ${err.message}`);
  }

  const runnerCwdContainsGit = fs.existsSync(path.join(work, ".git"));

  if (runnerReceipt) {
    requireEqual(runnerReceipt.object_type, "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_RECEIPT", "executed v0.8 runner receipt object_type", errors);
    requireEqual(runnerReceipt.schema_version, "0.8.0", "executed v0.8 runner receipt schema_version", errors);
    requireTrue(runnerReceipt.valid, "executed v0.8 runner receipt valid", errors);
    requireTrue(runnerReceipt.proves_v0_7_release_asset_hashes_verified, "executed v0.8 runner verifies v0.7 release assets", errors);
    requireTrue(runnerReceipt.proves_public_execution_receipt_valid, "executed v0.8 runner validates public execution receipt", errors);
    requireFalse(runnerReceipt.local_working_tree_required_for_auditor, "executed v0.8 runner local working tree required", errors);
    requireFalse(runnerReceipt.private_source_required, "executed v0.8 runner private source required", errors);
  }

  requireFalse(runnerCwdContainsGit, "v0.8 runner cwd contains .git", errors);

  const ok = errors.length === 0;

  const receipt = {
    object_type: "INVOCORDER_PUBLIC_AUDIT_CHAIN_CLOSURE_RECEIPT",
    schema_version: "1.0.0",
    jurisdiction: "INVOCORDER",
    valid: ok,
    errors,
    standard_path: STANDARD_PATH,
    standard_sha256_canonical_json: sha256CanonicalJson(standard),
    source_repository: standard.source_repository,
    audited_public_artifact_count: artifacts.length,
    audited_chain_nodes: standard.chain_nodes,
    artifacts,
    executed_v0_8_runner_from_release_asset: true,
    executed_v0_8_runner_exit_status: runnerExitStatus,
    executed_v0_8_runner_cwd_kind: "temporary_clean_directory_without_git_repository",
    executed_v0_8_runner_cwd_contains_git_directory: runnerCwdContainsGit,
    executed_v0_8_runner_receipt_object_type: runnerReceipt?.object_type || null,
    executed_v0_8_runner_receipt_schema_version: runnerReceipt?.schema_version || null,
    executed_v0_8_runner_receipt_valid: runnerReceipt?.valid || false,
    executed_v0_8_runner_v0_7_asset_hashes_verified: runnerReceipt?.proves_v0_7_release_asset_hashes_verified === true,
    public_repository_contents_required_for_v0_4_v0_5: true,
    public_release_assets_required_for_v0_6_to_v0_9: true,
    local_working_tree_required_for_audited_chain: false,
    private_source_required: false,
    proves_public_audit_chain_closure: ok,
    proves_v0_4_public_org_perimeter_bound: ok,
    proves_v0_5_public_fixture_consumption_bound: ok,
    proves_v0_6_public_fixture_execution_bound: ok,
    proves_v0_7_public_release_consumption_bound: ok,
    proves_v0_8_public_auditor_runner_bound: ok,
    proves_v0_9_public_auditor_runner_consumption_bound: ok,
    proves_v0_8_runner_executes_from_clean_temp_directory: ok,
    proves_non_claim_boundary_preserved: ok,
    proves_truth: false,
    proves_authorization: false,
    proves_safety: false,
    proves_admissibility: false,
    proves_external_reality: false
  };

  fs.writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify(receipt, null, 2));

  if (!ok) process.exit(1);
}

main().catch(err => {
  const receipt = {
    object_type: "INVOCORDER_PUBLIC_AUDIT_CHAIN_CLOSURE_RECEIPT",
    schema_version: "1.0.0",
    jurisdiction: "INVOCORDER",
    valid: false,
    errors: [err.message],
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
