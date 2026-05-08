#!/usr/bin/env node

import { runCommand } from "../process/run-command.js";

const args = process.argv.slice(2);

if (args[0] !== "run" || args[1] !== "--" || args.length < 3) {
  console.error("Usage: invocorder run -- <command> [args...]");
  process.exit(2);
}

const command = args[2];
const commandArgs = args.slice(3);

runCommand(command, commandArgs).catch((error) => {
  console.error(error);
  process.exit(1);
});
