#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();
const standardPath = join(repoRoot, "LOCAL_TOPOLOGY", "INVOCORDER_LOCAL_TOPOLOGY_LEDGER_STANDARD.json");
const receiptPath = join(repoRoot, "LOCAL_TOPOLOGY", "INVOCORDER_LOCAL_TOPOLOGY_LEDGER_RECEIPT.json");

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function shouldIgnore(relPath) {
  const parts = relPath.split("/");
  if (parts.includes(".git")) return true;
  if (parts.includes("node_modules")) return true;
  if (parts.includes("dist")) return true;
  if (parts.includes(".invocorder")) return true;
  if (parts.includes(".DS_Store")) return true;
  if (relPath.endsWith(".tgz")) return true;
  if (relPath.endsWith(".tar.gz")) return true;
  if (relPath.endsWith(".mp4")) return true;
  return false;
}

function walkFiles(root, base = root) {
  if (!existsSync(root)) return [];
  const out = [];
  for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const abs = join(root, entry.name);
    const rel = relative(base, abs).replaceAll("\\", "/");
    if (shouldIgnore(rel)) continue;
    if (entry.isDirectory()) {
      out.push(...walkFiles(abs, base));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

function inspectSurface(workspaceRoot, surface) {
  const absolutePath = join(workspaceRoot, surface.path);
  const exists = existsSync(absolutePath);
  const required_files = surface.required_files.map((file) => {
    const path = join(absolutePath, file);
    return {
      file,
      exists: existsSync(path),
      sha256: existsSync(path) && statSync(path).isFile() ? sha256File(path) : null
    };
  });
  const files = exists ? walkFiles(absolutePath) : [];
  const fileHashLines = files.map((file) => `${file}\t${sha256File(join(absolutePath, file))}`);
  const topology_hash = sha256Text(fileHashLines.join("\n"));
  return {
    id: surface.id,
    path: surface.path,
    role: surface.role,
    required: surface.required,
    exists,
    required_files,
    missing_required_files: required_files.filter((item) => !item.exists).map((item) => item.file),
    inspected_file_count: files.length,
    topology_hash
  };
}

const standard = loadJson(standardPath);
const workspaceRootArgIndex = process.argv.indexOf("--workspace-root");
const workspaceRoot = workspaceRootArgIndex >= 0 ? process.argv[workspaceRootArgIndex + 1] : join(repoRoot, "..");
const requireLocal = process.argv.includes("--require-local");

const inspected = standard.declared_surfaces.map((surface) => inspectSurface(workspaceRoot, surface));
const failures = [];

for (const surface of inspected) {
  if (surface.required && !surface.exists) {
    failures.push(`required surface missing: ${surface.path}`);
  }
  for (const missing of surface.missing_required_files) {
    failures.push(`required file missing: ${surface.path}/${missing}`);
  }
}

const receipt = {
  schema: "invocorder.local_topology_ledger.receipt.v1",
  status: failures.length === 0 ? "LOCAL_TOPOLOGY_LEDGER_VERIFIED" : "LOCAL_TOPOLOGY_LEDGER_FAILED",
  owner_repo: standard.owner_repo,
  workspace_root: workspaceRoot,
  require_local: requireLocal,
  standard_hash: sha256File(standardPath),
  inspected_surface_count: inspected.length,
  inspected_surfaces: inspected,
  ignored_for_hashing: standard.ignored_for_hashing,
  non_claims: standard.non_claims,
  failures_count: failures.length,
  failures
};

mkdirSync(join(repoRoot, "LOCAL_TOPOLOGY"), { recursive: true });
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));

if (failures.length > 0) {
  process.exit(1);
}
