#!/usr/bin/env node

import cp from "node:child_process";
import fs from "node:fs";

function run(command, args, options = {}) {
return cp.execFileSync(command, args, {
encoding: "utf8",
...options
});
}

function readJson(path) {
return JSON.parse(fs.readFileSync(path, "utf8"));
}

const failures = [];
const pkg = readJson("package.json");

if (pkg.name !== "@invocorder/recorder") {
failures.push("package name mismatch");
}

if (pkg.version !== "2.0.0") {
failures.push("package version mismatch");
}

if (pkg.private !== false) {
failures.push("package must be public/private false");
}

if (!pkg.publishConfig || pkg.publishConfig.access !== "public") {
failures.push("publishConfig.access must be public");
}

const scripts = pkg.scripts || {};

if (!scripts.test) {
failures.push("missing npm test script");
}

if ((scripts.test || "").includes("|| true")) {
failures.push("npm test must not tolerate failure");
}

if ((scripts["release:check"] || "").includes("workspace:perimeter")) {
failures.push("release:check must not depend on workspace perimeter");
}

if ((scripts["release:check"] || "").includes("topology:verify")) {
failures.push("release:check must not depend on local topology");
}

if (!(scripts["release:check"] || "").includes("hard:surface")) {
failures.push("release:check must include hard:surface");
}

if (
!(scripts["release:check"] || "").includes(
"power:ecosystem:verify"
)
) {
failures.push(
"release:check must include power:ecosystem:verify"
);
}

const gitFiles = run("git", ["ls-files"])
.trim()
.split("\n")
.filter(Boolean);

const forbiddenCommitted = gitFiles.filter(
(file) =>
file.startsWith("node_modules/") ||
file.startsWith("dist/") ||
file.startsWith(".invocorder/") ||
file.startsWith("CINEMATICUM/") ||
/.(mp4|tgz|tar.gz)$/.test(file)
);

if (forbiddenCommitted.length) {
failures.push(
`forbidden committed files: ${forbiddenCommitted.join(", ")}`
);
}

const requiredCommitted = [
"README.md",
"VERSION",
"LICENSE",
"package.json",
"bin/invocorder.js",
"src/cli/invocorder.ts",
"src/mcp/record-mcp-stdio-file.ts",
"scripts/verify-hard-product-surface.mjs",
"scripts/verify-live-ecosystem-map.mjs",
"tests/product-surface.test.ts",
"docs/START_HERE.md",
"docs/LIVE_POWER_MAP.md",
"examples/readable-demo/mcp-session.jsonl",
"POWER_PLANE/INVOCORDER_NPM_POWER_PLANE_STANDARD.json",
"POWER_PLANE/INVOCORDER_LIVE_ECOSYSTEM_MAP.json",
"POWER_PLANE/INVOCORDER_PUBLIC_ECOSYSTEM_INVENTORY_RECEIPT.json",
"WORKSPACE_PERIMETER/INVOCORDER_LOCAL_WORKSPACE_PERIMETER_STANDARD.json",
"LOCAL_TOPOLOGY/INVOCORDER_LOCAL_TOPOLOGY_LEDGER_STANDARD.json",
"STACK_PUBLICATION_READINESS/INVOCORDER_STACK_PUBLICATION_READINESS_STANDARD.json"
];

for (const file of requiredCommitted) {
if (!fs.existsSync(file)) {
failures.push(`required committed product file missing: ${file}`);
}
}

const runtimeModules = [
  "src/effects/scan-file-effects.ts",
  "src/effects/snapshot-env.ts",
  "src/process/capture-exit.ts",
  "src/process/capture-stdio.ts",
  "src/redaction/load-redaction-policy.ts",
  "src/redaction/redact-record.ts"
];

for (const runtimeModule of runtimeModules) {
  const source = fs.readFileSync(
    runtimeModule,
    "utf8"
  ).trim();

  if (
    source === "export {};" ||
    source.length < 100
  ) {
    failures.push(
      `INVOCORDER_RUNTIME_MODULE_STUB: ${runtimeModule}`
    );
  }
}

const packJson = JSON.parse(
run(
"npm",
["pack", "--dry-run", "--json"],
{ stdio: ["ignore", "pipe", "pipe"] }
)
)[0];

const packFiles = packJson.files
.map((file) => file.path)
.sort();

const forbiddenPackage = packFiles.filter(
(file) =>
file.startsWith("node_modules/") ||
file.startsWith(".invocorder/") ||
file.startsWith("CINEMATICUM/") ||
file.startsWith("INVOCORDER-org/") ||
/.(mp4|tgz|tar.gz)$/.test(file)
);

if (forbiddenPackage.length) {
failures.push(
`forbidden package files: ${forbiddenPackage.join(", ")}`
);
}

const requiredPackageTop = [
"COMMERCIAL-LICENSE.md",
"LICENSE",
"LOCAL_TOPOLOGY",
"POWER_PLANE",
"PUBLISH_DECISION.md",
"README.md",
"SECURITY.md",
"STACKED_PR_LEDGER",
"STACK_GREEN_LEDGER",
"STACK_MERGE_READINESS",
"STACK_PUBLICATION_READINESS",
"STACK_RELEASE_CANDIDATE",
"STACK_TERMINALITY",
"VERSION",
"WORKSPACE_PERIMETER",
"bin",
"dist",
"docs",
"examples",
"package.json"
];

const packageTop = [
...new Set(packFiles.map((file) => file.split("/")[0]))
].sort();

for (const entry of requiredPackageTop) {
if (!packageTop.includes(entry)) {
failures.push(`required package surface missing: ${entry}`);
}
}

const requiredPackageFiles = [
"README.md",
"bin/invocorder.js",
"docs/START_HERE.md",
"docs/LIVE_POWER_MAP.md",
"examples/readable-demo/mcp-session.jsonl",
"POWER_PLANE/INVOCORDER_LIVE_ECOSYSTEM_MAP.json",
"POWER_PLANE/INVOCORDER_PUBLIC_ECOSYSTEM_INVENTORY_RECEIPT.json",
"dist/src/cli/invocorder.js"
];

for (const file of requiredPackageFiles) {
if (!packFiles.includes(file)) {
failures.push(`required package file missing: ${file}`);
}
}

const inventory = readJson(
"POWER_PLANE/INVOCORDER_PUBLIC_ECOSYSTEM_INVENTORY_RECEIPT.json"
);

const privateRepositoryLeak = (
inventory.public_repositories || []
).filter(
(repository) =>
repository.private !== false ||
repository.visibility !== "public"
);

if (privateRepositoryLeak.length) {
failures.push("private or non-public repository inventory leak");
}

const result = {
schema: "invocorder.hard_product_surface.verification.v2",
status:
failures.length === 0
? "INVOCORDER_HARD_PRODUCT_SURFACE_VERIFIED"
: "INVOCORDER_HARD_PRODUCT_SURFACE_FAILED",
package_name: pkg.name,
package_version: pkg.version,
committed_file_count: gitFiles.length,
package_file_count: packFiles.length,
package_size: packJson.size,
unpacked_size: packJson.unpackedSize,
public_repository_count:
inventory.public_repository_count,
private_repository_names_excluded:
inventory.capture_basis?.private_repository_names_excluded === true,
forbidden_committed_files: forbiddenCommitted,
forbidden_package_files: forbiddenPackage,
package_top_level_surface: packageTop,
non_claims: {
hard_surface_is_truth: false,
npm_pack_dry_run_is_publication: false,
package_presence_is_runtime_safety: false,
successful_checks_are_approval: false,
ecosystem_inventory_is_whole_stack_completion: false,
release_check_is_system_completion: false
},
failures_count: failures.length,
failures
};

console.log(JSON.stringify(result, null, 2));

if (failures.length > 0) {
process.exit(1);
}

console.log("INVOCORDER_HARD_PRODUCT_SURFACE_VERIFY_PASS=true");
console.log("INVOCORDER_PACKAGE_SURFACE_FORBIDDEN_LEAK=false");
console.log("INVOCORDER_PRIVATE_REPOSITORY_NAMES_EXCLUDED=true");
console.log("INVOCORDER_NO_WORKSPACE_RELEASE_GATE=true");
