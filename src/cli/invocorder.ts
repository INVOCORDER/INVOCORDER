#!/usr/bin/env node

import { runCommand } from "../process/run-command.js";
import { recordMcpStdioFile } from "../mcp/record-mcp-stdio-file.js";

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

  console.error("Usage:");
  console.error("  invocorder run -- <command> [args...]");
  console.error("  invocorder mcp-stdio-file <jsonl-file>");
  process.exit(2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
