import fs from "node:fs";
import crypto from "node:crypto";

const writeReceipt = process.argv.includes("--write-receipt");

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function sha256(path) {
  return crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const pkg = readJson("package.json");
const lock = readJson("package-lock.json");
const standard = readJson("POWER_PLANE/INVOCORDER_NPM_POWER_PLANE_STANDARD.json");
const versionFile = fs.readFileSync("VERSION", "utf8").trim();
const source = fs.readFileSync("src/power/npm-power-plane.ts", "utf8");
const cli = fs.readFileSync("src/cli/invocorder.ts", "utf8");
const prepublish = fs.readFileSync("scripts/prepublish-gate.mjs", "utf8");

assert(pkg.name === "@invocorder/recorder", "package identity changed");
assert(pkg.version === versionFile, "package.json version must match VERSION");
assert(pkg.license === "SEE LICENSE IN LICENSE", "license posture changed");
assert(standard.schema === "invocorder.npm_power_plane.standard.v1", "standard schema mismatch");
assert(standard.package_name === "@invocorder/recorder", "standard package mismatch");
assert(standard.counts.total_bound_packages === 21, "bound package count mismatch");
assert(standard.counts.native_packages === 1, "native package count mismatch");
assert(standard.counts.external_runtime_dependencies === 20, "external dependency count mismatch");
assert(standard.packages.some((entry) => entry.name === "@invocorder/recorder" && entry.native === true && entry.dependency === false), "native self package boundary missing");
assert(!pkg.dependencies?.["@invocorder/recorder"], "recursive self dependency is forbidden");

for (const [key, value] of Object.entries(standard.non_claims)) {
  assert(value === false, `non-claim must remain false: ${key}`);
}

const rootLock = lock.packages?.[""];
assert(rootLock, "package-lock root package missing");

for (const record of standard.packages) {
  assert(source.includes(record.name), `source missing package: ${record.name}`);

  if (!record.dependency) continue;

  const packageJsonSpec = pkg.dependencies?.[record.name];
  assert(typeof packageJsonSpec === "string" && packageJsonSpec.length > 0, `package.json missing dependency: ${record.name}`);
  assert(/^(\^|~|\*|>=|>|<=|<|\d|latest)/.test(packageJsonSpec), `dependency is not updateable semver/registry spec: ${record.name}`);

  const lockSpec = rootLock.dependencies?.[record.name];
  assert(typeof lockSpec === "string" && lockSpec.length > 0, `package-lock root missing dependency: ${record.name}`);
}

assert(cli.includes("inspectNpmPowerPlane"), "CLI import for npm power plane missing");
assert(cli.includes("power-plane"), "CLI power-plane command missing");
assert(prepublish.includes("VERSION"), "prepublish gate must bind package version to VERSION file");
assert(prepublish.includes("verify-npm-power-plane.mjs"), "prepublish gate must run npm power plane verifier");

const receipt = {
  schema: "invocorder.npm_power_plane.receipt.v1",
  receipt_id: "INVOCORDER_NPM_POWER_PLANE_RECEIPT",
  status: "PASS",
  generated_at_utc: new Date().toISOString(),
  package_name: pkg.name,
  package_version: pkg.version,
  standard_sha256: sha256("POWER_PLANE/INVOCORDER_NPM_POWER_PLANE_STANDARD.json"),
  package_lock_sha256: sha256("package-lock.json"),
  total_bound_packages: standard.counts.total_bound_packages,
  native_packages: standard.counts.native_packages,
  external_runtime_dependencies: standard.counts.external_runtime_dependencies,
  installed_dependency_specs: standard.packages
    .filter((record) => record.dependency)
    .map((record) => ({
      name: record.name,
      package_json_spec: pkg.dependencies[record.name],
      lock_root_spec: rootLock.dependencies[record.name],
      role_class: record.role_class,
      claim_boundary: record.claim_boundary
    })),
  native_boundary: {
    name: "@invocorder/recorder",
    recursive_self_dependency: false
  },
  non_claims: standard.non_claims
};

if (writeReceipt) {
  fs.writeFileSync("POWER_PLANE/INVOCORDER_NPM_POWER_PLANE_RECEIPT.json", JSON.stringify(receipt, null, 2) + "\n");
}

if (fs.existsSync("POWER_PLANE/INVOCORDER_NPM_POWER_PLANE_RECEIPT.json")) {
  const existing = readJson("POWER_PLANE/INVOCORDER_NPM_POWER_PLANE_RECEIPT.json");
  assert(existing.schema === receipt.schema, "receipt schema mismatch");
  assert(existing.status === "PASS", "receipt status mismatch");
  assert(existing.total_bound_packages === 21, "receipt package count mismatch");
  assert(existing.external_runtime_dependencies === 20, "receipt dependency count mismatch");
}

console.log("INVOCORDER_NPM_POWER_PLANE_VERIFY_PASS=true");
console.log("TOTAL_BOUND_PACKAGES=21");
console.log("EXTERNAL_RUNTIME_DEPENDENCIES=20");
console.log("NATIVE_SELF_PACKAGE_BOUND=true");
console.log("PACKAGE_INSTALLATION_NOT_TRUTH=true");
