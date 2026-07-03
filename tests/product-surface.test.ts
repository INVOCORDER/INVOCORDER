import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import cp from "node:child_process";

function run(command: string, args: string[]): string {
  return cp.execFileSync(command, args, { encoding: "utf8" });
}

function readJson(path: string): any {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

test("package test script is strict and release gate is product-local", () => {
  const pkg = readJson("package.json");

  assert.equal(pkg.name, "@invocorder/recorder");
  assert.equal(pkg.version, "2.0.0");
  assert.equal(pkg.private, false);

  assert.ok(pkg.scripts.test);
  assert.equal(pkg.scripts.test.includes("|| true"), false);

  assert.ok(pkg.scripts["release:check"].includes("hard:surface"));
  assert.equal(pkg.scripts["release:check"].includes("workspace:perimeter"), false);
  assert.equal(pkg.scripts["release:check"].includes("topology:verify"), false);
});

test("committed product surface excludes generated and workspace-only payloads", () => {
  const files = run("git", ["ls-files"]).trim().split("\n").filter(Boolean);

  const forbidden = files.filter((file) =>
    /^node_modules\//.test(file) ||
    /^dist\//.test(file) ||
    /^\.invocorder\//.test(file) ||
    /^CINEMATICUM\//.test(file) ||
    /\.(mp4|tgz|tar\.gz)$/.test(file)
  );

  assert.deepEqual(forbidden, []);
  assert.ok(files.includes("src/mcp/record-mcp-stdio-file.ts"));
  assert.ok(files.includes("scripts/verify-hard-product-surface.mjs"));
});

test("npm package surface excludes forbidden workspace payloads", () => {
  const pack = JSON.parse(run("npm", ["pack", "--dry-run", "--json"]))[0];
  const files = pack.files.map((file: { path: string }) => file.path).sort();

  const forbidden = files.filter((file: string) =>
    /^node_modules\//.test(file) ||
    /^\.invocorder\//.test(file) ||
    /^CINEMATICUM\//.test(file) ||
    /^INVOCORDER-org\//.test(file) ||
    /\.(mp4|tgz|tar\.gz)$/.test(file)
  );

  assert.deepEqual(forbidden, []);
  assert.ok(files.includes("bin/invocorder.js"));
  assert.ok(files.includes("dist/src/mcp/record-mcp-stdio-file.js"));
  assert.ok(files.includes("README.md"));
});
