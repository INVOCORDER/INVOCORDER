#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function run(command, args) {
  console.log(`$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false
  });
  assert(result.status === 0, `${command} ${args.join(" ")} failed`);
}

function runCapture(command, args) {
  console.log(`$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  assert(result.status === 0, `${command} ${args.join(" ")} failed`);
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function writePrepublishMcpFixture(path) {
  mkdirSync(dirname(path), { recursive: true });

  const frames = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {}
    },
    {
      jsonrpc: "2.0",
      id: 1,
      result: {
        tools: []
      }
    },
    {
      id: 2,
      method: "tools/call",
      params: {
        name: "missing-jsonrpc-boundary"
      }
    }
  ];

  writeFileSync(path, frames.map((frame) => JSON.stringify(frame)).join("\n") + "\n");
}

function resolveHostileFixtureRoot() {
  if (existsSync("../HOSTILE-FIXTURES/fixtures")) {
    return "../HOSTILE-FIXTURES/fixtures";
  }

  const cloneRoot = mkdtempSync(
    join(tmpdir(), "invocorder-hostile-fixtures-")
  );

  run("git", [
    "clone",
    "--depth",
    "1",
    "https://github.com/INVOCORDER/HOSTILE-FIXTURES.git",
    cloneRoot
  ]);

  return join(cloneRoot, "fixtures");
}

const pkg = readJson("package.json");
const version = readFileSync("VERSION", "utf8").trim();

assert(pkg.name === "@invocorder/recorder", "package name boundary mismatch");
assert(pkg.version === version, "package.json version must match VERSION");
assert(pkg.private === false, "package must remain publishable");
assert(pkg.type === "module", "package must remain ESM");
assert(pkg.license === "SEE LICENSE IN LICENSE", "license declaration changed");

const files = new Set(pkg.files ?? []);
for (const requiredFile of [
  "dist",
  "schemas",
  "docs",
  "README.md",
  "LICENSE",
  "COMMERCIAL-LICENSE.md",
  "VERSION",
  "bin",
  "SECURITY.md",
  "PUBLISH_DECISION.md",
  "POWER_PLANE"
]) {
  assert(files.has(requiredFile), `package files missing ${requiredFile}`);
}

for (const requiredPath of [
  "README.md",
  "LICENSE",
  "COMMERCIAL-LICENSE.md",
  "SECURITY.md",
  "PUBLISH_DECISION.md",
  "VERSION",
  "bin/invocorder.js",
  "POWER_PLANE/INVOCORDER_NPM_POWER_PLANE_STANDARD.json",
  "scripts/verify-npm-power-plane.mjs",
  "src/power/npm-power-plane.ts",
  "src/cli/invocorder.ts"
]) {
  assert(existsSync(requiredPath), `required release file missing ${requiredPath}`);
}

assert(!pkg.dependencies?.["@invocorder/recorder"], "native package must not depend on itself");
assert(pkg.dependencies?.["@verifrax/originseal"], "originseal dependency missing");
assert(pkg.dependencies?.["@verifrax/validexor"], "validexor dependency missing");
assert(pkg.scripts?.["power:verify"] === "node scripts/verify-npm-power-plane.mjs", "power verifier script missing");
assert((pkg.scripts?.["release:check"] ?? "").includes("power:verify"), "release check must include power verifier");

run("npm", ["run", "build"]);

for (const builtPath of [
  "dist/src/cli/invocorder.js",
  "dist/src/power/npm-power-plane.js"
]) {
  assert(existsSync(builtPath), `built release file missing ${builtPath}`);
}

run("node", ["scripts/verify-npm-power-plane.mjs"]);

const fixturePath = ".invocorder/prepublish/mcp-session.jsonl";
writePrepublishMcpFixture(fixturePath);

const mcpOutput = runCapture("node", ["bin/invocorder.js", "mcp-stdio-file", fixturePath]);
const sessionMatch = mcpOutput.match(/INVOCORDER MCP session:\s*(.+)/);
assert(sessionMatch, "MCP session path not emitted");
const sessionPath = sessionMatch[1].trim();

run("node", ["bin/invocorder.js", "verify-bundle", join(sessionPath, "replay-bundle.json")]);

mkdirSync(".invocorder/keys", { recursive: true });
rmSync(".invocorder/keys/prepublish-ed25519.pem", { force: true });

run("node", ["bin/invocorder.js", "generate-signing-key", ".invocorder/keys/prepublish-ed25519.pem"]);
run("node", ["bin/invocorder.js", "sign-bundle", join(sessionPath, "replay-bundle.json"), "--key", ".invocorder/keys/prepublish-ed25519.pem"]);
run("node", ["bin/invocorder.js", "verify-signed-bundle", join(sessionPath, "signed-bundle-envelope.json")]);

const hostileFixtureRoot =
  resolveHostileFixtureRoot();

run("node", [
  "dist/src/fixtures/run-mcp-fixtures.js",
  join(hostileFixtureRoot, "mcp")
]);

run("node", [
  "dist/src/fixtures/run-signed-bundle-fixtures.js",
  join(hostileFixtureRoot, "signed-bundles")
]);

run("npm", ["pack", "--dry-run"]);

console.log("INVOCORDER_PREPUBLISH_GATE_PASS=true");
