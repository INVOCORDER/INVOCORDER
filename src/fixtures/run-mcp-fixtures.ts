#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { recordMcpStdioFile } from "../mcp/record-mcp-stdio-file.js";

type FixtureRunResult = {
  fixture: string;
  session: string;
  integrity_valid: boolean;
  errors: string[];
};

function findLatestSession(): string {
  const root = ".invocorder/sessions";
  if (!existsSync(root)) {
    throw new Error("no .invocorder sessions directory");
  }

  const sessions = readdirSync(root)
    .filter((name: string) => name.startsWith("act_"))
    .map((name: string) => join(root, name))
    .sort((a: string, b: string) => statSync(b).mtimeMs - statSync(a).mtimeMs);

  if (!sessions[0]) {
    throw new Error("no sessions found");
  }

  return sessions[0];
}

function assertNoOverclaim(bundlePath: string): void {
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));

  if (bundle.claims?.proves_truth !== false) throw new Error("bundle overclaims truth");
  if (bundle.claims?.proves_safety !== false) throw new Error("bundle overclaims safety");
  if (bundle.claims?.proves_authorization !== false) throw new Error("bundle overclaims authorization");
  if (bundle.claims?.proves_integrity !== true) throw new Error("bundle does not claim integrity");
}

async function main(): Promise<void> {
  const fixtureRoot = process.argv[2] ?? "../HOSTILE-FIXTURES/fixtures/mcp";

  if (!existsSync(fixtureRoot)) {
    throw new Error(`fixture root not found: ${fixtureRoot}`);
  }

  const index = JSON.parse(readFileSync(join(fixtureRoot, "INDEX.json"), "utf8")) as { fixtures: string[] };
  const results: FixtureRunResult[] = [];

  rmSync(".invocorder/fixture-runs", { recursive: true, force: true });
  mkdirSync(".invocorder/fixture-runs", { recursive: true });

  for (const slug of index.fixtures) {
    const input = join(fixtureRoot, slug, "input/mcp-session.jsonl");

    await recordMcpStdioFile(input);

    const sessionDir = findLatestSession();
    const integrityPath = join(sessionDir, "bundle-integrity-result.json");
    const bundlePath = join(sessionDir, "replay-bundle.json");

    const integrity = JSON.parse(readFileSync(integrityPath, "utf8")) as { valid: boolean; errors: string[] };
    assertNoOverclaim(bundlePath);

    results.push({
      fixture: slug,
      session: sessionDir,
      integrity_valid: integrity.valid,
      errors: integrity.errors
    });
  }

  const report = {
    object_type: "INVOCORDER_MCP_FIXTURE_RUN_REPORT",
    schema_version: "0.2.1",
    fixture_root: fixtureRoot,
    fixture_count: results.length,
    results
  };

  writeFileSync(".invocorder/fixture-runs/mcp-fixture-run-report.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
