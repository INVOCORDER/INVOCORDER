#!/usr/bin/env node

import { runCommand } from "../process/run-command.js";
import { recordMcpStdioFile } from "../mcp/record-mcp-stdio-file.js";
import { verifyBundleFile } from "../bundle/verify-bundle-file.js";
import { signBundleFile, verifySignedBundleEnvelope } from "../signing/sign-bundle-file.js";

const args = process.argv.slice(2);

async function main(): Promise<void> {
  if (args[0] === "run" && args[1] === "--" && args.length >= 3) {
    const command = args[2];
    const commandArgs = args.slice(3);
    await runCommand(command, commandArgs);
    return;
  }

  if (args[0] === "mcp-stdio-file" && args[1]) {
    await recordMcpStdioFile(args[1]);
    return;
  }

  if (args[0] === "verify-bundle" && args[1]) {
    const result = verifyBundleFile(args[1]);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.valid ? 0 : 1);
  }

  if (args[0] === "sign-bundle" && args[1]) {
    const envelope = signBundleFile(args[1]);
    console.log(JSON.stringify(envelope, null, 2));
    return;
  }

  if (args[0] === "verify-signed-bundle" && args[1]) {
    const result = verifySignedBundleEnvelope(args[1]);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.valid ? 0 : 1);
  }

  console.error("Usage:");
  console.error("  invocorder run -- <command> [args...]");
  console.error("  invocorder mcp-stdio-file <jsonl-file>");
  console.error("  invocorder verify-bundle <replay-bundle.json>");
  console.error("  invocorder sign-bundle <replay-bundle.json>");
  console.error("  invocorder verify-signed-bundle <signed-bundle-envelope.json>");
  process.exit(2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
