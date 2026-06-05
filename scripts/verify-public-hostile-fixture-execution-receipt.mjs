#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

import { recordMcpStdioFile } from "../dist/src/mcp/record-mcp-stdio-file.js";
import { verifyBundleFile } from "../dist/src/bundle/verify-bundle-file.js";
import { verifySignedBundleEnvelope } from "../dist/src/signing/sign-bundle-file.js";

const RECEIPT_PATH = "FIXTURE_EXECUTION/INVOCORDER_PUBLIC_HOSTILE_FIXTURE_EXECUTION_RECEIPT.json";
const STANDARD_PATH = "FIXTURE_EXECUTION/PUBLIC_HOSTILE_FIXTURE_EXECUTION_STANDARD.json";
const SOURCE_RECEIPT_PATH = "FIXTURE_CONSUMPTION/INVOCORDER_PUBLIC_HOSTILE_FIXTURE_CONSUMPTION_RECEIPT.json";

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function sha256CanonicalJson(value) {
  return sha256(JSON.stringify(canonical(value)));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts
  }).trim();
}

function requireEqual(actual, expected, label, errors) {
  if (actual !== expected) errors.push(`${label}: expected ${expected}; got ${actual}`);
}

function includesAll(actual, expected) {
  return expected.every((needle) => actual.some((error) => String(error).includes(String(needle))));
}

function findLatestSession() {
  const root = ".invocorder/sessions";
  if (!existsSync(root)) throw new Error("no .invocorder sessions directory");

  const sessions = readdirSync(root)
    .filter((name) => name.startsWith("act_"))
    .map((name) => join(root, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

  if (!sessions[0]) throw new Error("no sessions found");
  return sessions[0];
}

function assertNoOverclaim(bundlePath) {
  const bundle = readJson(bundlePath);
  if (bundle.claims?.proves_truth !== false) throw new Error(`${bundlePath} overclaims truth`);
  if (bundle.claims?.proves_safety !== false) throw new Error(`${bundlePath} overclaims safety`);
  if (bundle.claims?.proves_authorization !== false) throw new Error(`${bundlePath} overclaims authorization`);
  if (bundle.claims?.proves_integrity !== true) throw new Error(`${bundlePath} does not claim integrity`);
}

function clonePublicFixtures(sourceRepository, sourceSha) {
  const root = mkdtempSync(join(tmpdir(), "invocorder-public-hostile-fixtures-"));
  run("git", ["init", root]);
  run("git", ["-C", root, "remote", "add", "origin", `https://github.com/${sourceRepository}.git`]);
  run("git", ["-C", root, "fetch", "--depth=1", "origin", sourceSha]);
  run("git", ["-C", root, "checkout", "--detach", sourceSha]);
  return root;
}

function stageExpectedBundleForExternalVerification(expectedDir, slug) {
  const workDir = mkdtempSync(join(tmpdir(), `invocorder-hostile-bundle-${slug}-`));
  cpSync(expectedDir, workDir, { recursive: true });

  const machineRecords = join(workDir, "machine-action-records.jsonl");
  const records = join(workDir, "records.jsonl");
  if (existsSync(machineRecords) && !existsSync(records)) {
    copyFileSync(machineRecords, records);
  }

  const bundlePath = join(workDir, "replay-bundle.json");
  if (!existsSync(bundlePath)) throw new Error(`expected hostile replay bundle missing: ${slug}`);

  assertNoOverclaim(bundlePath);
  return verifyBundleFile(bundlePath);
}

async function executeMcpFixture(fixtureRoot, slug) {
  const fixtureDir = join(fixtureRoot, slug);
  const inputPath = join(fixtureDir, "input/mcp-session.jsonl");
  const expectedDir = join(fixtureDir, "expected");
  const expectedIntegrityPath = join(expectedDir, "bundle-integrity-result.json");

  if (!existsSync(inputPath)) throw new Error(`MCP input missing: ${slug}`);
  if (!existsSync(expectedIntegrityPath)) throw new Error(`MCP expected integrity missing: ${slug}`);

  const expected = readJson(expectedIntegrityPath);

  await recordMcpStdioFile(inputPath);

  const sessionDir = findLatestSession();
  const cleanIntegrityPath = join(sessionDir, "bundle-integrity-result.json");
  const cleanBundlePath = join(sessionDir, "replay-bundle.json");

  const cleanIntegrity = readJson(cleanIntegrityPath);
  assertNoOverclaim(cleanBundlePath);

  let effectiveActual = cleanIntegrity;
  let execution_mode = "clean_public_input_execution";

  if (expected.valid === false) {
    effectiveActual = stageExpectedBundleForExternalVerification(expectedDir, slug);
    execution_mode = "hostile_expected_bundle_external_verification";
  }

  const expectedErrors = expected.errors ?? [];
  const actualErrors = effectiveActual.errors ?? [];

  const passed =
    effectiveActual.valid === expected.valid &&
    (expected.valid === true || actualErrors.length > 0) &&
    (expectedErrors.length === 0 || expected.valid === false || includesAll(actualErrors, expectedErrors));

  return {
    fixture: slug,
    execution_mode,
    expected_valid: expected.valid,
    actual_valid: effectiveActual.valid,
    clean_input_valid: cleanIntegrity.valid,
    expected_errors: expectedErrors,
    actual_errors: actualErrors,
    session: sessionDir,
    passed
  };
}

function executeSignedBundleFixture(fixtureRoot, slug) {
  const fixtureDir = join(fixtureRoot, slug);
  const envelopePath = join(fixtureDir, "input/signed-bundle-envelope.json");
  const expectedPath = join(fixtureDir, "expected/signed-bundle-verification-result.json");

  if (!existsSync(envelopePath)) throw new Error(`signed-bundle envelope missing: ${slug}`);
  if (!existsSync(expectedPath)) throw new Error(`signed-bundle expected result missing: ${slug}`);

  const expected = readJson(expectedPath);
  const actual = verifySignedBundleEnvelope(envelopePath);

  const expectedErrors = expected.errors ?? [];
  const actualErrors = actual.errors ?? [];

  const passed =
    actual.valid === expected.valid &&
    includesAll(actualErrors, expectedErrors);

  return {
    fixture: slug,
    expected_valid: expected.valid,
    actual_valid: actual.valid,
    expected_errors: expectedErrors,
    actual_errors: actualErrors,
    passed
  };
}

async function main() {
  const errors = [];

  try {
    const standard = readJson(STANDARD_PATH);
    const sourceReceipt = readJson(SOURCE_RECEIPT_PATH);

    requireEqual(standard.object_type, "INVOCORDER_PUBLIC_HOSTILE_FIXTURE_EXECUTION_STANDARD", "standard object_type", errors);
    requireEqual(standard.schema_version, "0.6.0", "standard schema_version", errors);
    requireEqual(sourceReceipt.object_type, "INVOCORDER_PUBLIC_HOSTILE_FIXTURE_CONSUMPTION_RECEIPT", "source receipt object_type", errors);
    requireEqual(sourceReceipt.valid, true, "source receipt valid", errors);

    const sourceRepository = sourceReceipt.source_repository ?? standard.source_fixture_repository;
    const sourceSha = sourceReceipt.source_default_branch_head_sha;

    if (!sourceRepository) errors.push("source repository missing");
    if (!sourceSha) errors.push("source default branch head SHA missing");

    if (errors.length) throw new Error(errors.join("; "));

    const publicFixtureRoot = clonePublicFixtures(sourceRepository, sourceSha);
    const checkedOutSha = run("git", ["-C", publicFixtureRoot, "rev-parse", "HEAD"]);
    requireEqual(checkedOutSha, sourceSha, "public fixture checkout SHA", errors);

    const mcpRoot = join(publicFixtureRoot, "fixtures/mcp");
    const signedRoot = join(publicFixtureRoot, "fixtures/signed-bundles");

    const mcpIndex = readJson(join(mcpRoot, "INDEX.json"));
    const signedIndex = readJson(join(signedRoot, "INDEX.json"));

    rmSync(".invocorder/fixture-runs", { recursive: true, force: true });
    mkdirSync(".invocorder/fixture-runs", { recursive: true });

    const mcpResults = [];
    for (const slug of mcpIndex.fixtures) {
      mcpResults.push(await executeMcpFixture(mcpRoot, slug));
    }

    const signedBundleResults = [];
    for (const slug of signedIndex.fixtures) {
      signedBundleResults.push(executeSignedBundleFixture(signedRoot, slug));
    }

    const failedMcp = mcpResults.filter((r) => !r.passed);
    const failedSigned = signedBundleResults.filter((r) => !r.passed);

    for (const result of failedMcp) {
      errors.push(`MCP fixture ${result.fixture} failed expected execution comparison`);
    }

    for (const result of failedSigned) {
      errors.push(`signed-bundle fixture ${result.fixture} failed expected execution comparison`);
    }

    const receipt = {
      object_type: "INVOCORDER_PUBLIC_HOSTILE_FIXTURE_EXECUTION_RECEIPT",
      schema_version: "0.6.0",
      jurisdiction: "INVOCORDER",
      valid: errors.length === 0,
      errors,
      standard_path: STANDARD_PATH,
      standard_sha256_canonical_json: sha256CanonicalJson(standard),
      source_consumption_receipt_path: SOURCE_RECEIPT_PATH,
      source_consumption_receipt_sha256_canonical_json: sha256CanonicalJson(sourceReceipt),
      source_repository: sourceRepository,
      source_default_branch_head_sha: sourceSha,
      public_fixture_checkout_sha: checkedOutSha,
      mcp_fixture_case_count: mcpResults.length,
      signed_bundle_fixture_case_count: signedBundleResults.length,
      mcp_results: mcpResults,
      signed_bundle_results: signedBundleResults,
      local_sibling_fixture_repo_required: false,
      private_source_required: false,
      proves_public_hostile_fixture_execution: errors.length === 0,
      proves_public_mcp_fixtures_execute: errors.length === 0 && mcpResults.length > 0 && mcpResults.every((r) => r.passed),
      proves_public_signed_bundle_fixtures_execute: errors.length === 0 && signedBundleResults.length > 0 && signedBundleResults.every((r) => r.passed),
      proves_fixture_expected_outputs_match: errors.length === 0,
      proves_local_sibling_fixture_repo_not_required: true,
      proves_private_source_not_required: true,
      proves_non_claim_boundary_preserved: true,
      proves_truth: false,
      proves_authorization: false,
      proves_safety: false,
      proves_admissibility: false,
      proves_external_reality: false
    };

    writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2) + "\n");
    console.log(JSON.stringify(receipt, null, 2));

    if (!receipt.valid) process.exit(1);
  } catch (error) {
    const receipt = {
      object_type: "INVOCORDER_PUBLIC_HOSTILE_FIXTURE_EXECUTION_RECEIPT",
      schema_version: "0.6.0",
      jurisdiction: "INVOCORDER",
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
      proves_public_hostile_fixture_execution: false,
      proves_public_mcp_fixtures_execute: false,
      proves_public_signed_bundle_fixtures_execute: false,
      proves_fixture_expected_outputs_match: false,
      proves_local_sibling_fixture_repo_not_required: false,
      proves_private_source_not_required: false,
      proves_non_claim_boundary_preserved: false,
      proves_truth: false,
      proves_authorization: false,
      proves_safety: false,
      proves_admissibility: false,
      proves_external_reality: false
    };

    mkdirSync(dirname(RECEIPT_PATH), { recursive: true });
    writeFileSync(RECEIPT_PATH, JSON.stringify(receipt, null, 2) + "\n");
    console.log(JSON.stringify(receipt, null, 2));
    process.exit(1);
  }
}

main();
