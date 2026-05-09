import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  console.log(`$ ${command} ${args.join(" ")}`);
  return execFileSync(command, args, { stdio: "inherit", ...options });
}

function runCapture(command, args, options = {}) {
  console.log(`$ ${command} ${args.join(" ")}`);
  return execFileSync(command, args, { encoding: "utf8", ...options });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert(pkg.name === "@invocorder/recorder", "wrong package name");
assert(/^0\.3\.\d+$/.test(pkg.version), "wrong package version");
assert(pkg.license === "SEE LICENSE IN LICENSE", "license posture changed");
assert(pkg.private === false, "package must be publish-enabled only in publish-decision PR");
assert(pkg.publishConfig?.access === "public", "publishConfig must be public only in publish-decision PR");
assert(pkg.bin?.invocorder === "./dist/src/cli/invocorder.js" || pkg.bin?.invocorder === "./dist/cli/invocorder.js", "unexpected bin path");

for (const required of [
  "README.md",
  "LICENSE",
  "COMMERCIAL-LICENSE.md",
  "SECURITY.md",
  "VERSION",
  "PUBLISH_DECISION.md"
]) {
  assert(fs.existsSync(required), `missing required file: ${required}`);
}

run("npm", ["run", "build"]);

const cli = fs.existsSync("dist/src/cli/invocorder.js")
  ? "dist/src/cli/invocorder.js"
  : "dist/cli/invocorder.js";

assert(fs.existsSync(cli), "compiled CLI missing");

run("node", [cli, "mcp-stdio-file", "examples/mcp-stdio/session.jsonl"]);

const sessions = fs.readdirSync(".invocorder/sessions")
  .filter((name) => name.startsWith("act_"))
  .map((name) => `.invocorder/sessions/${name}`)
  .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

assert(sessions[0], "no session emitted");
const session = sessions[0];

run("node", [cli, "verify-bundle", `${session}/replay-bundle.json`]);

const tamperDir = ".invocorder/prepublish-tamper";
fs.rmSync(tamperDir, { recursive: true, force: true });
fs.mkdirSync(tamperDir, { recursive: true });

for (const file of ["records.jsonl", "session.json", "omissions.jsonl", "replay-bundle.json"]) {
  fs.copyFileSync(`${session}/${file}`, `${tamperDir}/${file}`);
}

fs.appendFileSync(`${tamperDir}/records.jsonl`, `\n{"tampered":true}\n`);

const tamper = spawnSync("node", [cli, "verify-bundle", `${tamperDir}/replay-bundle.json`], {
  encoding: "utf8"
});

assert(tamper.status !== 0, "tampered bundle unexpectedly verified");

const keyPath = ".invocorder/keys/prepublish-ed25519.pem";
fs.rmSync(keyPath, { force: true });
run("node", [cli, "generate-signing-key", keyPath]);
run("node", [cli, "sign-bundle", `${session}/replay-bundle.json`, "--key", keyPath]);
run("node", [cli, "verify-signed-bundle", `${session}/signed-bundle-envelope.json`]);

fs.appendFileSync(`${session}/replay-bundle.json`, `\n{"tampered":true}\n`);
const signedTamper = spawnSync("node", [cli, "verify-signed-bundle", `${session}/signed-bundle-envelope.json`], {
  encoding: "utf8"
});

assert(signedTamper.status !== 0, "tampered signed bundle unexpectedly verified");

run("node", ["dist/src/fixtures/run-mcp-fixtures.js", "../HOSTILE-FIXTURES/fixtures/mcp"]);
run("node", ["dist/src/fixtures/run-signed-bundle-fixtures.js", "../HOSTILE-FIXTURES/fixtures/signed-bundles"]);

const pack = runCapture("npm", ["pack", "--dry-run"]);
assert(pack.includes(`invocorder-recorder-${pkg.version}.tgz`), "pack output missing expected tarball filename");

console.log("INVOCORDER prepublish gate passed");
