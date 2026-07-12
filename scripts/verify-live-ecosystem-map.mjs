#!/usr/bin/env node

import cp from "node:child_process";
import fs from "node:fs";

function readJson(path) {
return JSON.parse(fs.readFileSync(path, "utf8"));
}

function run(command, args) {
return cp.execFileSync(command, args, {
encoding: "utf8",
stdio: ["ignore", "pipe", "pipe"]
}).trim();
}

const liveMode = process.argv.includes("--live");
const failures = [];

const map = readJson("POWER_PLANE/INVOCORDER_LIVE_ECOSYSTEM_MAP.json");
const inventory = readJson(
"POWER_PLANE/INVOCORDER_PUBLIC_ECOSYSTEM_INVENTORY_RECEIPT.json"
);
const pkg = readJson("package.json");

const expectedPackages = [
"@verifrax/originseal",
"@verifrax/archicustos",
"@verifrax/kairoclasp",
"@verifrax/limenward",
"@verifrax/validexor",
"@verifrax/attestorium",
"@verifrax/irrevocull",
"@verifrax/guillotine",
"@verifrax/auctoriseal",
"@verifrax/corpiform",
"@verifrax/cicullis",
"@verifrax/verifrax-verify",
"@verifrax/verifrax-profiles",
"@verifrax/verifrax-spec",
"@verifrax/verifrax",
"@verifrax/sigillarium",
"@verifrax/verifrax-api",
"@verifrax/root",
"@kaaffilm/mk10-pro",
"@invocorder/recorder",
"@antimatterium/antimatterium"
];

const expectedOwners = [
"midiakiasat",
"CINEMATICUM",
"INVOCORDER",
"kaaffilm",
"qvra",
"qvro",
"qvru",
"qxra",
"qxvi",
"qxvo",
"qzro",
"qzru",
"TRUTHFRAMER",
"VATFix",
"Verifrax",
"ANTIMATTERIUM"
];

if (map.schema !== "invocorder.live_ecosystem_power_map.v1") {
failures.push("power map schema mismatch");
}

if (inventory.schema !== "invocorder.public_ecosystem_inventory_receipt.v1") {
failures.push("inventory schema mismatch");
}

if (map.native_product?.package !== "@invocorder/recorder") {
failures.push("native package mismatch");
}

if (map.native_product?.repository !== "INVOCORDER/INVOCORDER") {
failures.push("native repository mismatch");
}

const packages = Array.isArray(map.npm_packages) ? map.npm_packages : [];
const packageNames = packages.map((entry) => entry.name);

for (const packageName of expectedPackages) {
if (!packageNames.includes(packageName)) {
failures.push(`missing package: ${packageName}`);
}

if (
packageName !== "@invocorder/recorder" &&
!pkg.dependencies?.[packageName]
) {
failures.push(`package dependency not bound: ${packageName}`);
}
}

if (new Set(packageNames).size !== packageNames.length) {
failures.push("duplicate package records");
}

const owners = Array.isArray(map.github_owners) ? map.github_owners : [];
const ownerNames = owners.map((entry) => entry.owner);

for (const owner of expectedOwners) {
if (!ownerNames.includes(owner)) {
failures.push(`missing GitHub owner: ${owner}`);
}
}

const repositories = Array.isArray(inventory.public_repositories)
? inventory.public_repositories
: [];

for (const repository of repositories) {
if (repository.private !== false) {
failures.push(`private repository leaked: ${repository.full_name}`);
}

if (repository.visibility !== "public") {
failures.push(`non-public repository leaked: ${repository.full_name}`);
}
}

if (inventory.capture_basis?.public_only !== true) {
failures.push("inventory must be public-only");
}

if (inventory.capture_basis?.private_repository_names_excluded !== true) {
failures.push("private repository exclusion missing");
}

if (inventory.public_repository_count !== repositories.length) {
failures.push("public repository count mismatch");
}

if (map.non_claims?.ecosystem_map_completes_whole_stack !== false) {
failures.push("whole-stack non-claim missing");
}

const liveResults = {
npm: [],
github: []
};

if (liveMode) {
for (const packageName of expectedPackages) {
try {
const version = run("npm", ["view", packageName, "version"]);
liveResults.npm.push({
name: packageName,
available: true,
version
});
} catch (error) {
failures.push(`live npm lookup failed: ${packageName}`);
liveResults.npm.push({
name: packageName,
available: false
});
}
}

for (const owner of expectedOwners) {
try {
const ownerType = run("gh", ["api", `users/${owner}`, "--jq", ".type"]);
liveResults.github.push({
owner,
available: true,
type: ownerType
});
} catch (error) {
failures.push(`live GitHub owner lookup failed: ${owner}`);
liveResults.github.push({
owner,
available: false
});
}
}
}

const result = {
schema: "invocorder.live_ecosystem_power_map.verification.v1",
status:
failures.length === 0
? "INVOCORDER_LIVE_ECOSYSTEM_MAP_VERIFIED"
: "INVOCORDER_LIVE_ECOSYSTEM_MAP_FAILED",
live_mode: liveMode,
npm_package_count: packages.length,
github_owner_count: owners.length,
public_repository_count: repositories.length,
private_repository_names_excluded:
inventory.capture_basis?.private_repository_names_excluded === true,
live_results: liveMode ? liveResults : undefined,
non_claims: map.non_claims,
failures_count: failures.length,
failures
};

console.log(JSON.stringify(result, null, 2));

if (failures.length > 0) {
process.exit(1);
}

console.log("INVOCORDER_LIVE_ECOSYSTEM_MAP_VERIFY_PASS=true");
console.log("INVOCORDER_PUBLIC_REPOSITORY_INVENTORY_BOUND=true");
console.log("INVOCORDER_PRIVATE_REPOSITORY_NAMES_EXCLUDED=true");
console.log("INVOCORDER_WHOLE_STACK_COMPLETE=false");
