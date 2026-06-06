import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const OUT = "AUDIT/INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_CONSUMPTION_RECEIPT.json";
const STANDARD_PATH = "AUDIT/PUBLIC_RELEASE_AUDITOR_RUNNER_CONSUMPTION_STANDARD.json";

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

function requireTrue(value, label, errors) {
  if (value !== true) errors.push(`${label}: expected true; got ${value}`);
}

function requireFalse(value, label, errors) {
  if (value !== false) errors.push(`${label}: expected false; got ${value}`);
}

function getJson(url) {
  const headers = {
    "User-Agent": "invocorder-v090-public-auditor-runner-consumption",
    "Accept": "application/vnd.github+json"
  };
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;

  return new Promise((resolve, reject) => {
    https.get(url, { headers }, res => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`GET ${url} -> ${res.statusCode}: ${data.slice(0, 500)}`));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch (err) { reject(err); }
      });
    }).on("error", reject);
  });
}

function download(url) {
  const headers = { "User-Agent": "invocorder-v090-public-auditor-runner-consumption" };
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;

  return new Promise((resolve, reject) => {
    https.get(url, { headers }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        download(res.headers.location).then(resolve, reject);
        return;
      }

      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        const body = Buffer.concat(chunks);
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`download ${url} -> ${res.statusCode}: ${body.toString("utf8", 0, 500)}`));
          return;
        }
        resolve(body);
      });
    }).on("error", reject);
  });
}

function extractJsonObjectByType(text, objectType) {
  const marker = `"object_type": "${objectType}"`;
  const idx = text.indexOf(marker);
  if (idx < 0) throw new Error(`could not find ${objectType} in runner output`);

  const start = text.lastIndexOf("{", idx);
  if (start < 0) throw new Error("could not locate JSON start");

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}") depth--;
    if (depth === 0) return JSON.parse(text.slice(start, i + 1));
  }

  throw new Error("could not locate JSON end");
}

async function main() {
  const errors = [];
  const standard = readJson(STANDARD_PATH);

  requireEqual(standard.object_type, "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_CONSUMPTION_STANDARD", "standard object_type", errors);
  requireEqual(standard.schema_version, "0.9.0", "standard schema_version", errors);
  requireFalse(standard.local_working_tree_required_for_auditor, "standard local_working_tree_required_for_auditor", errors);
  requireFalse(standard.private_source_required, "standard private_source_required", errors);

  const expectedHashes = standard.expected_public_release_asset_hashes || {};
  const releaseApi = `https://api.github.com/repos/${standard.source_repository}/releases/tags/${standard.source_release_tag}`;
  const release = await getJson(releaseApi);

  const assetsByName = new Map((release.assets || []).map(a => [a.name, a]));
  const consumed = [];
  const assetBuffers = new Map();

  for (const name of standard.required_public_release_assets) {
    const asset = assetsByName.get(name);
    if (!asset) {
      errors.push(`missing source release asset: ${name}`);
      continue;
    }

    const bytes = await download(asset.browser_download_url);
    assetBuffers.set(name, bytes);

    const entry = {
      name,
      size_bytes: bytes.length,
      sha256: sha256(bytes),
      browser_download_url: asset.browser_download_url
    };

    if (name.endsWith(".json")) {
      const parsed = JSON.parse(bytes.toString("utf8"));
      entry.sha256_canonical_json = sha256CanonicalJson(parsed);
    }

    const expected = expectedHashes[name];
    if (!expected) {
      errors.push(`missing expected hash binding for ${name}`);
    } else {
      entry.expected_sha256 = expected.sha256;
      requireEqual(entry.sha256, expected.sha256, `${name} sha256`, errors);

      if (expected.sha256_canonical_json) {
        entry.expected_sha256_canonical_json = expected.sha256_canonical_json;
        requireEqual(entry.sha256_canonical_json, expected.sha256_canonical_json, `${name} canonical sha256`, errors);
      }
    }

    consumed.push(entry);
  }

  const runnerName = "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER.mjs";
  const sourceReceiptName = "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_RECEIPT.json";
  const sourceStandardName = "PUBLIC_RELEASE_AUDITOR_RUNNER_STANDARD.json";

  const sourceReceipt = JSON.parse(assetBuffers.get(sourceReceiptName).toString("utf8"));
  const sourceStandard = JSON.parse(assetBuffers.get(sourceStandardName).toString("utf8"));
  const runnerBytes = assetBuffers.get(runnerName);

  requireEqual(sourceReceipt.object_type, standard.required_source_receipt_object_type, "source receipt object_type", errors);
  requireEqual(sourceReceipt.schema_version, standard.required_source_receipt_schema_version, "source receipt schema_version", errors);
  requireTrue(sourceReceipt.valid, "source receipt valid", errors);
  requireFalse(sourceReceipt.local_working_tree_required_for_auditor, "source receipt local_working_tree_required_for_auditor", errors);
  requireFalse(sourceReceipt.private_source_required, "source receipt private_source_required", errors);

  requireEqual(sha256(runnerBytes), expectedHashes[runnerName].sha256, "runner sha256 bound by v0.9 standard", errors);
  requireEqual(sha256CanonicalJson(sourceReceipt), expectedHashes[sourceReceiptName].sha256_canonical_json, "source receipt canonical sha bound by v0.9 standard", errors);
  requireEqual(sha256CanonicalJson(sourceStandard), expectedHashes[sourceStandardName].sha256_canonical_json, "source standard canonical sha bound by v0.9 standard", errors);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "invocorder-v090-public-auditor-"));
  const work = path.join(tmp, "clean-auditor-work");
  const auditDir = path.join(work, "AUDIT");
  fs.mkdirSync(auditDir, { recursive: true });

  const runnerPath = path.join(auditDir, runnerName);
  fs.writeFileSync(runnerPath, runnerBytes);
  fs.writeFileSync(path.join(auditDir, sourceStandardName), assetBuffers.get(sourceStandardName));
  fs.writeFileSync(path.join(auditDir, sourceReceiptName), assetBuffers.get(sourceReceiptName));
  fs.chmodSync(runnerPath, 0o755);

  const cwdContainsGitDirectory = fs.existsSync(path.join(work, ".git"));

  let runnerStdout = "";
  let runnerReceipt = null;
  let runnerExitStatus = 0;

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

    const generatedReceiptPath = path.join(auditDir, "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_RECEIPT.json");
    if (fs.existsSync(generatedReceiptPath)) {
      runnerReceipt = JSON.parse(fs.readFileSync(generatedReceiptPath, "utf8"));
    } else {
      runnerReceipt = extractJsonObjectByType(runnerStdout, "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_RECEIPT");
    }
  } catch (err) {
    runnerExitStatus = typeof err.status === "number" ? err.status : 1;
    errors.push(`runner execution failed: ${err.message}`);
    if (err.stderr) errors.push(`runner stderr: ${String(err.stderr).slice(0, 1000)}`);
  }

  if (runnerReceipt) {
    requireEqual(runnerReceipt.object_type, "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_RECEIPT", "runner receipt object_type", errors);
    requireEqual(runnerReceipt.schema_version, "0.8.0", "runner receipt schema_version", errors);
    requireTrue(runnerReceipt.valid, "runner receipt valid", errors);
    requireTrue(runnerReceipt.proves_v0_7_release_asset_hashes_verified, "runner proves v0.7 asset hashes verified", errors);
    requireTrue(runnerReceipt.proves_public_execution_receipt_valid, "runner proves public execution receipt valid", errors);
    requireFalse(runnerReceipt.local_working_tree_required_for_auditor, "runner local_working_tree_required_for_auditor", errors);
    requireFalse(runnerReceipt.private_source_required, "runner private_source_required", errors);
  }

  requireFalse(cwdContainsGitDirectory, "runner cwd contains .git", errors);

  const ok = errors.length === 0;

  const result = {
    object_type: "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_CONSUMPTION_RECEIPT",
    schema_version: "0.9.0",
    jurisdiction: "INVOCORDER",
    valid: ok,
    errors,
    standard_path: STANDARD_PATH,
    standard_sha256_canonical_json: sha256CanonicalJson(standard),
    source_repository: standard.source_repository,
    source_release_tag: standard.source_release_tag,
    source_release_url: release.html_url,
    consumed_public_release_assets: consumed,
    downloaded_source_receipt_object_type: sourceReceipt.object_type,
    downloaded_source_receipt_schema_version: sourceReceipt.schema_version,
    downloaded_source_receipt_valid: sourceReceipt.valid,
    runner_execution_exit_status: runnerExitStatus,
    runner_execution_cwd_kind: "temporary_clean_directory_without_git_repository",
    runner_execution_cwd_contains_git_directory: cwdContainsGitDirectory,
    runner_stdout_bytes: Buffer.byteLength(runnerStdout || "", "utf8"),
    executed_runner_receipt_object_type: runnerReceipt?.object_type || null,
    executed_runner_receipt_schema_version: runnerReceipt?.schema_version || null,
    executed_runner_receipt_valid: runnerReceipt?.valid || false,
    executed_runner_v0_7_asset_hashes_verified: runnerReceipt?.proves_v0_7_release_asset_hashes_verified === true,
    local_working_tree_required_for_auditor: false,
    private_source_required: false,
    public_release_asset_download_required: true,
    proves_public_release_auditor_runner_publicly_consumed: ok,
    proves_downloaded_runner_hash_verified_against_v0_9_standard: ok,
    proves_downloaded_source_receipt_hash_verified_against_v0_9_standard: ok,
    proves_downloaded_runner_executes_from_clean_temp_directory: ok,
    proves_v0_7_release_assets_verified_by_downloaded_runner: ok,
    proves_local_working_tree_not_required_for_auditor: ok,
    proves_private_source_not_required: ok,
    proves_non_claim_boundary_preserved: ok,
    proves_truth: false,
    proves_authorization: false,
    proves_safety: false,
    proves_admissibility: false,
    proves_external_reality: false
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));

  if (!result.valid) process.exit(1);
}

main().catch(err => {
  const result = {
    object_type: "INVOCORDER_PUBLIC_RELEASE_AUDITOR_RUNNER_CONSUMPTION_RECEIPT",
    schema_version: "0.9.0",
    jurisdiction: "INVOCORDER",
    valid: false,
    errors: [err.message],
    proves_truth: false,
    proves_authorization: false,
    proves_safety: false,
    proves_admissibility: false,
    proves_external_reality: false
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
});
