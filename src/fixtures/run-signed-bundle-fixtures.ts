#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { verifySignedBundleEnvelope } from "../signing/sign-bundle-file.js";

type Expected = {
  valid: boolean;
  errors: string[];
};

type FixtureResult = {
  fixture: string;
  expected_valid: boolean;
  actual_valid: boolean;
  expected_errors: string[];
  actual_errors: string[];
  passed: boolean;
};

function includesAll(actual: string[], expected: string[]): boolean {
  return expected.every((needle) => actual.some((error) => error.includes(needle)));
}

async function main(): Promise<void> {
  const fixtureRoot = process.argv[2] ?? "../HOSTILE-FIXTURES/fixtures/signed-bundles";

  if (!existsSync(fixtureRoot)) {
    throw new Error(`fixture root not found: ${fixtureRoot}`);
  }

  const index = JSON.parse(readFileSync(join(fixtureRoot, "INDEX.json"), "utf8")) as { fixtures: string[] };
  const results: FixtureResult[] = [];

  rmSync(".invocorder/fixture-runs", { recursive: true, force: true });
  mkdirSync(".invocorder/fixture-runs", { recursive: true });

  for (const slug of index.fixtures) {
    const fixtureDir = join(fixtureRoot, slug);
    const envelopePath = join(fixtureDir, "input/signed-bundle-envelope.json");
    const expectedPath = join(fixtureDir, "expected/signed-bundle-verification-result.json");

    const expected = JSON.parse(readFileSync(expectedPath, "utf8")) as Expected;
    const actual = verifySignedBundleEnvelope(envelopePath);

    const passed =
      actual.valid === expected.valid &&
      includesAll(actual.errors, expected.errors);

    results.push({
      fixture: slug,
      expected_valid: expected.valid,
      actual_valid: actual.valid,
      expected_errors: expected.errors,
      actual_errors: actual.errors,
      passed
    });
  }

  const report = {
    object_type: "INVOCORDER_SIGNED_BUNDLE_FIXTURE_RUN_REPORT",
    schema_version: "0.3.2",
    fixture_root: fixtureRoot,
    fixture_count: results.length,
    passed: results.every((result) => result.passed),
    results
  };

  writeFileSync(".invocorder/fixture-runs/signed-bundle-fixture-run-report.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));

  if (!report.passed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
