#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compileReplayBundle } from "../bundle/compile-replay-bundle.js";
import { verifyBundleFile } from "../bundle/verify-bundle-file.js";
import { recordMcpStdioFile } from "../mcp/record-mcp-stdio-file.js";
import {
  recordBoundaryJsonlFile,
  type BoundaryKind
} from "../capture/record-boundary-jsonl-file.js";
import { inspectLocalWorkspacePerimeter } from "../perimeter/local-workspace-perimeter.js";
import { inspectNpmPowerPlane } from "../power/npm-power-plane.js";
import { runCommand } from "../process/run-command.js";
import {
createSigningKeyFile
} from "../signing/keys/key-store.js";
import {
signBundleFile,
signBundleFileWithKey,
verifySignedBundleEnvelope
} from "../signing/sign-bundle-file.js";
import { inspectLocalTopologyLedger } from "../topology/local-topology-ledger.js";

const args = process.argv.slice(2);

function packageRoot(): string {
const moduleDirectory = dirname(fileURLToPath(import.meta.url));
return resolve(moduleDirectory, "../../..");
}

function readPackageJson(relativePath: string): Record<string, unknown> {
return JSON.parse(
readFileSync(resolve(packageRoot(), relativePath), "utf8")
) as Record<string, unknown>;
}

function writeReadableDemoInput(): string {
const inputPath = ".invocorder/readable-demo/mcp-session.jsonl";

mkdirSync(dirname(inputPath), { recursive: true });

const frames = [
{
jsonrpc: "2.0",
id: 1,
method: "tools/call",
params: {
name: "explain-invocorder",
arguments: {
question: "What does INVOCORDER do?"
}
}
},
{
jsonrpc: "2.0",
id: 1,
result: {
content: [
{
type: "text",
text:
"INVOCORDER records machine-action boundary facts into " +
"hash-chained replayable evidence bundles."
}
]
}
},
{
jsonrpc: "2.0",
id: 2,
method: "tools/call",
params: {
name: "show-live-power",
arguments: {
native: "@invocorder/recorder",
external_examples: [
"@verifrax/verifrax",
"@kaaffilm/mk10-pro",
"@antimatterium/antimatterium"
]
}
}
},
{
jsonrpc: "2.0",
id: 2,
result: {
content: [
{
type: "text",
text:
"The ecosystem is mapped for recording and discovery without " +
"claiming whole-stack completion."
}
]
}
}
];

writeFileSync(
inputPath,
frames.map((frame) => JSON.stringify(frame)).join("\n") + "\n"
);

return inputPath;
}

function printUsage(): void {
console.error("INVOCORDER — machine-action evidence recorder");
console.error("");
console.error("Easy commands:");
console.error("  invocorder demo");
console.error("  invocorder power-map [--all]");
console.error("");
console.error("Recording and verification:");
console.error("  invocorder run -- <command> [args...]");
console.error("  invocorder mcp-stdio-file <jsonl-file>");
console.error(
  "  invocorder record-jsonl <kind> <jsonl-file> [name]"
);
console.error("  invocorder verify-bundle <replay-bundle.json>");
console.error("  invocorder generate-signing-key <private-key.pem>");
console.error(
"  invocorder sign-bundle <replay-bundle.json> [--key <private-key.pem>]"
);
console.error(
"  invocorder verify-signed-bundle <signed-bundle-envelope.json>"
);
console.error("");
console.error("Power and topology:");
console.error("  invocorder power-plane");
console.error("  invocorder local-topology [--workspace-root <path>]");
console.error(
"  invocorder workspace-perimeter " +
"[--workspace-root <path>] [--require-local]"
);
}

async function main(): Promise<void> {
if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
printUsage();
return;
}

if (args[0] === "demo" || args[0] === "demo-readable") {
const demoInput = writeReadableDemoInput();

await recordMcpStdioFile(demoInput);

const powerPlane = inspectNpmPowerPlane();

console.log(
  JSON.stringify(
    {
      schema: "invocorder.readable_demo.result.v1",
      status: "INVOCORDER_READABLE_DEMO_COMPLETE",
      explanation:
        "A small MCP-style interaction was recorded into a " +
        "hash-chained replayable evidence session.",
      demo_input: demoInput,
      generated_session_root: ".invocorder/sessions",
      npm_power_packages_bound: powerPlane.total_bound_packages,
      installed_external_dependencies:
        powerPlane.installed_external_dependencies,
      missing_external_dependencies:
        powerPlane.missing_external_dependencies,
      next_commands: [
        "invocorder power-map",
        "invocorder power-map --all"
      ],
      non_claims: {
        demo_proves_truth: false,
        demo_proves_safety: false,
        demo_proves_authorization: false,
        demo_proves_admissibility: false,
        demo_completes_whole_stack: false
      }
    },
    null,
    2
  )
);

return;

}

if (args[0] === "power-map") {
const showAll = args.includes("--all");

const map = readPackageJson(
  "POWER_PLANE/INVOCORDER_LIVE_ECOSYSTEM_MAP.json"
);

const inventory = readPackageJson(
  "POWER_PLANE/INVOCORDER_PUBLIC_ECOSYSTEM_INVENTORY_RECEIPT.json"
);

const powerPlane = inspectNpmPowerPlane();

const npmPackages = Array.isArray(map.npm_packages)
  ? map.npm_packages
  : [];

const githubOwners = Array.isArray(map.github_owners)
  ? map.github_owners
  : [];

const publicRepositories = Array.isArray(inventory.public_repositories)
  ? inventory.public_repositories
  : [];

console.log(
  JSON.stringify(
    {
      schema: "invocorder.readable_power_map.result.v1",
      status: "INVOCORDER_READABLE_POWER_MAP_READY",
      product: map.native_product,
      simple_model: map.simple_model,
      npm: {
        bound_package_count: npmPackages.length,
        installed_external_dependencies:
          powerPlane.installed_external_dependencies,
        missing_external_dependencies:
          powerPlane.missing_external_dependencies,
        packages: npmPackages
      },
      github: {
        owner_count: githubOwners.length,
        public_repository_count: publicRepositories.length,
        private_repository_names_excluded:
          inventory.capture_basis &&
          typeof inventory.capture_basis === "object" &&
          "private_repository_names_excluded" in
            inventory.capture_basis
            ? (
                inventory.capture_basis as {
                  private_repository_names_excluded?: unknown;
                }
              ).private_repository_names_excluded
            : null,
        owners: githubOwners,
        repositories: showAll ? publicRepositories : undefined,
        hint: showAll
          ? undefined
          : "Run invocorder power-map --all for every public repository."
      },
      non_claims: map.non_claims
    },
    null,
    2
  )
);

return;

}

if (args[0] === "local-topology") {
const workspaceRootIndex = args.indexOf("--workspace-root");
const workspaceRoot =
workspaceRootIndex >= 0 ? args[workspaceRootIndex + 1] : undefined;

if (workspaceRootIndex >= 0 && !workspaceRoot) {
  throw new Error("--workspace-root requires a path");
}

const receipt = inspectLocalTopologyLedger(workspaceRoot);
console.log(JSON.stringify(receipt, null, 2));

if (receipt.failures.length > 0) {
  process.exitCode = 1;
}

return;

}

if (args[0] === "workspace-perimeter") {
const requireLocal =
args.includes("--require-local") || args.includes("--local");

const workspaceRootIndex = args.indexOf("--workspace-root");
const workspaceRoot =
  workspaceRootIndex >= 0 ? args[workspaceRootIndex + 1] : undefined;

if (workspaceRootIndex >= 0 && !workspaceRoot) {
  throw new Error("--workspace-root requires a path");
}

const receipt = inspectLocalWorkspacePerimeter({
  workspaceRoot,
  requireSiblings: requireLocal
});

console.log(JSON.stringify(receipt, null, 2));

if (receipt.failures.length > 0) {
  process.exitCode = 1;
}

return;

}

if (args[0] === "run" && args[1] === "--" && args.length >= 3) {
await runCommand(args[2], args.slice(3));
return;
}

if (args[0] === "mcp-stdio-file" && args[1]) {
await recordMcpStdioFile(args[1]);
return;
}

if (args[0] === "record-jsonl") {
const kind = args[1];
const inputPath = args[2];

if (!kind || !inputPath) {
  throw new Error(
    "usage: invocorder record-jsonl <kind> <jsonl-file> [name]"
  );
}

const result = await recordBoundaryJsonlFile(
  inputPath,
  kind as BoundaryKind,
  args[3] ?? `${kind}-jsonl-frame`
);

console.log(
  JSON.stringify(
    {
      schema:
        "invocorder.boundary_jsonl_capture.result.v1",
      status: result.valid
        ? "INVOCORDER_BOUNDARY_JSONL_CAPTURE_VALID"
        : "INVOCORDER_BOUNDARY_JSONL_CAPTURE_INVALID",
      ...result
    },
    null,
    2
  )
);

process.exitCode = result.valid ? 0 : 1;
return;
}

if (args[0] === "verify-bundle" && args[1]) {
const result = verifyBundleFile(args[1]);
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.valid ? 0 : 1;
return;
}

if (args[0] === "generate-signing-key" && args[1]) {
const key = createSigningKeyFile(args[1]);
console.log(JSON.stringify(key, null, 2));
return;
}

if (args[0] === "sign-bundle" && args[1]) {
const keyIndex = args.indexOf("--key");

const envelope =
  keyIndex >= 0 && args[keyIndex + 1]
    ? signBundleFileWithKey(args[1], args[keyIndex + 1])
    : signBundleFile(args[1]);

console.log(JSON.stringify(envelope, null, 2));
return;

}

if (args[0] === "verify-signed-bundle" && args[1]) {
const result = verifySignedBundleEnvelope(args[1]);
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.valid ? 0 : 1;
return;
}

if (args[0] === "power-plane") {
console.log(JSON.stringify(inspectNpmPowerPlane(), null, 2));
return;
}

if (args[0] === "compile-bundle" && args[1] && args[2]) {
compileReplayBundle(args[1], args[2]);
return;
}

printUsage();
process.exitCode = 2;
}

main().catch((error: unknown) => {
console.error(error);
process.exit(1);
});
