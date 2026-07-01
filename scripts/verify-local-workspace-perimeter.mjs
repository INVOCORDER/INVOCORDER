#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const args = new Set(argv);
const requireLocal = args.has("--require-local") || args.has("--local");
const writeReceipt = args.has("--write-receipt");

let workspaceRoot = path.resolve(repoRoot, "..");
const workspaceRootFlag = argv.indexOf("--workspace-root");
if (workspaceRootFlag >= 0) {
  const value = argv[workspaceRootFlag + 1];
  if (!value) {
    throw new Error("--workspace-root requires a path");
  }
  workspaceRoot = path.resolve(value);
}

const standardPath = path.join(repoRoot, "WORKSPACE_PERIMETER", "INVOCORDER_LOCAL_WORKSPACE_PERIMETER_STANDARD.json");
const receiptPath = path.join(repoRoot, "WORKSPACE_PERIMETER", "INVOCORDER_LOCAL_WORKSPACE_PERIMETER_RECEIPT.json");
const sourcePath = path.join(repoRoot, "src", "perimeter", "local-workspace-perimeter.ts");
const cliPath = path.join(repoRoot, "src", "cli", "invocorder.ts");
const packagePath = path.join(repoRoot, "package.json");
const readmePath = path.join(repoRoot, "README.md");

const failures = [];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

for (const requiredPath of [standardPath, sourcePath, cliPath, packagePath, readmePath]) {
  if (!fs.existsSync(requiredPath)) {
    failures.push(`missing required INVOCORDER file: ${path.relative(repoRoot, requiredPath)}`);
  }
}

const standard = fs.existsSync(standardPath) ? readJson(standardPath) : null;
const pkg = fs.existsSync(packagePath) ? readJson(packagePath) : null;
const cli = fs.existsSync(cliPath) ? fs.readFileSync(cliPath, "utf8") : "";
const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf8") : "";

if (standard) {
  if (standard.schema !== "invocorder.local_workspace_perimeter_standard.v1") {
    failures.push("standard schema mismatch");
  }
  if (standard.truth_rule !== "LOCAL_WORKSPACE_PRESENCE_IS_EVIDENCE_NOT_ACCEPTED_TRUTH") {
    failures.push("workspace truth rule mismatch");
  }
  if (!Array.isArray(standard.surfaces) || standard.surfaces.length < 6) {
    failures.push("workspace surfaces missing or incomplete");
  }
  for (const denied of [
    "constitutional_law",
    "accepted_state",
    "authority_issuance",
    "verification_result",
    "terminal_recognition",
    "terminal_recourse",
    "system_completion"
  ]) {
    if (!standard.does_not_define?.includes(denied)) {
      failures.push(`missing non-claim boundary: ${denied}`);
    }
  }
}

if (pkg) {
  if (!pkg.files?.includes("WORKSPACE_PERIMETER")) {
    failures.push("package files missing WORKSPACE_PERIMETER");
  }
  if (!pkg.scripts?.["workspace:perimeter"]) {
    failures.push("package script workspace:perimeter missing");
  }
  if (!pkg.scripts?.["workspace:perimeter:local"]) {
    failures.push("package script workspace:perimeter:local missing");
  }
}

if (!cli.includes("workspace-perimeter")) {
  failures.push("CLI command workspace-perimeter missing");
}

if (!readme.includes("INVOCORDER_LOCAL_WORKSPACE_PERIMETER_START")) {
  failures.push("README local workspace perimeter block missing");
}

const inspectedSurfaces = [];
if (standard?.surfaces) {
  for (const surface of standard.surfaces) {
    const absolutePath = path.resolve(workspaceRoot, surface.path);
    const exists = fs.existsSync(absolutePath);
    const requiredFiles = surface.required_files.map((file) => {
      const filePath = path.resolve(absolutePath, file);
      return {
        file,
        exists: fs.existsSync(filePath)
      };
    });
    const missingRequiredFiles = requiredFiles.filter((entry) => !entry.exists).map((entry) => entry.file);
    inspectedSurfaces.push({
      id: surface.id,
      path: surface.path,
      role: surface.role,
      native: surface.native,
      required: surface.required,
      exists,
      required_files: requiredFiles,
      missing_required_files: missingRequiredFiles
    });

    if (requireLocal && surface.required) {
      if (!exists) {
        failures.push(`${surface.id}: missing surface directory ${surface.path}`);
      }
      for (const missingFile of missingRequiredFiles) {
        failures.push(`${surface.id}: missing required file ${missingFile}`);
      }
    }
  }
}

const result = {
  schema: "invocorder.local_workspace_perimeter_receipt.v1",
  status: failures.length === 0
    ? requireLocal
      ? "LOCAL_WORKSPACE_PERIMETER_VERIFIED"
      : "LOCAL_WORKSPACE_PERIMETER_BOUND"
    : "LOCAL_WORKSPACE_PERIMETER_FAIL",
  owner_repo: "INVOCORDER/INVOCORDER",
  workspace_root: workspaceRoot,
  require_local: requireLocal,
  standard_hash: fs.existsSync(standardPath) ? sha256(fs.readFileSync(standardPath)) : null,
  inspected_surface_count: inspectedSurfaces.length,
  inspected_surfaces: inspectedSurfaces,
  non_claims: {
    local_workspace_presence_is_truth: false,
    sibling_presence_expands_invocorder_role: false,
    node_modules_presence_is_source_authority: false,
    package_installation_is_verification_result: false,
    workspace_perimeter_is_system_completion: false
  },
  failures_count: failures.length,
  failures
};

if (writeReceipt) {
  fs.writeFileSync(receiptPath, JSON.stringify(result, null, 2) + "\n");
}

console.log(JSON.stringify(result, null, 2));

if (failures.length > 0) {
  process.exit(1);
}
