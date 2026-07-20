import assert from "node:assert/strict";
import cp from "node:child_process";
import fs from "node:fs";
import test from "node:test";

function run(command: string, args: string[]): string {
return cp.execFileSync(command, args, {
encoding: "utf8",
stdio: ["ignore", "pipe", "pipe"]
});
}

function readJson(path: string): any {
return JSON.parse(fs.readFileSync(path, "utf8"));
}

test("package test script is strict and release gate is product-local", () => {
const pkg = readJson("package.json");

assert.equal(pkg.name, "@invocorder/recorder");
assert.equal(pkg.version, "2.1.0");
assert.equal(pkg.private, false);

assert.ok(pkg.scripts.test);
assert.equal(pkg.scripts.test.includes("|| true"), false);

assert.ok(pkg.scripts["release:check"].includes("hard:surface"));
assert.ok(
pkg.scripts["release:check"].includes("power:ecosystem:verify")
);

assert.equal(
pkg.scripts["release:check"].includes("workspace:perimeter"),
false
);

assert.equal(
pkg.scripts["release:check"].includes("topology:verify"),
false
);
});

test("committed product surface excludes generated and workspace payloads", () => {
const files = run("git", ["ls-files"])
.trim()
.split("\n")
.filter(Boolean);

const forbidden = files.filter(
(file) =>
file.startsWith("node_modules/") ||
file.startsWith("dist/") ||
file.startsWith(".invocorder/") ||
file.startsWith("CINEMATICUM/") ||
/.(mp4|tgz|tar.gz)$/.test(file)
);

assert.deepEqual(forbidden, []);
assert.ok(files.includes("src/mcp/record-mcp-stdio-file.ts"));
assert.ok(files.includes("scripts/verify-hard-product-surface.mjs"));
assert.ok(files.includes("scripts/verify-live-ecosystem-map.mjs"));
assert.ok(
files.includes("POWER_PLANE/INVOCORDER_LIVE_ECOSYSTEM_MAP.json")
);
assert.ok(
files.includes(
"POWER_PLANE/" +
"INVOCORDER_PUBLIC_ECOSYSTEM_INVENTORY_RECEIPT.json"
)
);
});

test("npm package surface excludes forbidden workspace payloads", () => {
const pack = JSON.parse(
run("npm", ["pack", "--dry-run", "--json"])
)[0];

const files = pack.files
.map((file: { path: string }) => file.path)
.sort();

const forbidden = files.filter(
(file: string) =>
file.startsWith("node_modules/") ||
file.startsWith(".invocorder/") ||
file.startsWith("CINEMATICUM/") ||
file.startsWith("INVOCORDER-org/") ||
/.(mp4|tgz|tar.gz)$/.test(file)
);

assert.deepEqual(forbidden, []);
assert.ok(files.includes("bin/invocorder.js"));
assert.ok(files.includes("dist/src/mcp/record-mcp-stdio-file.js"));
assert.ok(files.includes("README.md"));
assert.ok(files.includes("docs/START_HERE.md"));
assert.ok(files.includes("docs/LIVE_POWER_MAP.md"));

assert.ok(
files.includes(
"POWER_PLANE/INVOCORDER_LIVE_ECOSYSTEM_MAP.json"
)
);

assert.ok(
files.includes(
"POWER_PLANE/" +
"INVOCORDER_PUBLIC_ECOSYSTEM_INVENTORY_RECEIPT.json"
)
);

assert.ok(
files.includes("examples/readable-demo/mcp-session.jsonl")
);
});

test("live ecosystem map binds packages and public repositories", () => {
const pkg = readJson("package.json");

const map = readJson(
"POWER_PLANE/INVOCORDER_LIVE_ECOSYSTEM_MAP.json"
);

const inventory = readJson(
"POWER_PLANE/INVOCORDER_PUBLIC_ECOSYSTEM_INVENTORY_RECEIPT.json"
);

assert.equal(
map.schema,
"invocorder.live_ecosystem_power_map.v1"
);

assert.equal(
inventory.schema,
"invocorder.public_ecosystem_inventory_receipt.v1"
);

assert.equal(map.native_product.package, "@invocorder/recorder");
assert.equal(map.native_product.repository, "INVOCORDER/INVOCORDER");

assert.equal(map.npm_packages.length, 21);
assert.equal(map.github_owners.length, 16);

assert.equal(inventory.capture_basis.public_only, true);
assert.equal(
inventory.capture_basis.private_repository_names_excluded,
true
);

assert.ok(
inventory.public_repositories.every(
(repository: {
private: boolean;
visibility: string;
}) =>
repository.private === false &&
repository.visibility === "public"
)
);

assert.equal(
map.non_claims.ecosystem_map_completes_whole_stack,
false
);

assert.equal(pkg.scripts.demo, "node bin/invocorder.js demo");
assert.equal(
pkg.scripts["power:ecosystem"],
"node bin/invocorder.js power-map"
);
});

test("readable CLI demo and power map execute", async () => {
const powerMap = JSON.parse(
run("node", ["bin/invocorder.js", "power-map"])
);

assert.equal(
powerMap.status,
"INVOCORDER_READABLE_POWER_MAP_READY"
);

assert.equal(powerMap.npm.bound_package_count, 21);
assert.equal(powerMap.github.owner_count, 16);
assert.equal(
powerMap.github.private_repository_names_excluded,
true
);

const demo = JSON.parse(
run("node", ["bin/invocorder.js", "demo"])
);

assert.equal(
demo.status,
"INVOCORDER_READABLE_DEMO_COMPLETE"
);

assert.equal(demo.non_claims.demo_completes_whole_stack, false);
});
