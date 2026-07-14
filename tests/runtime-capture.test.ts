import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import {
  join,
  resolve
} from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  diffFileSnapshots,
  snapshotFiles
} from "../src/effects/scan-file-effects.js";
import { snapshotEnvironment } from "../src/effects/snapshot-env.js";
import { createBoundedCapture } from "../src/process/capture-stdio.js";
import { normalizeProcessExit } from "../src/process/capture-exit.js";
import { redactRecord } from "../src/redaction/redact-record.js";

test("runtime modules are substantive", () => {
  const paths = [
    "src/effects/scan-file-effects.ts",
    "src/effects/snapshot-env.ts",
    "src/process/capture-exit.ts",
    "src/process/capture-stdio.ts",
    "src/redaction/load-redaction-policy.ts",
    "src/redaction/redact-record.ts"
  ];

  for (const path of paths) {
    const source = readFileSync(path, "utf8").trim();

    assert.notEqual(source, "export {};");
    assert.ok(source.length > 100);
  }
});

test("bounded stdio capture records truncation", () => {
  const capture = createBoundedCapture(4);

  capture.push("abcdef");

  const result = capture.finish();

  assert.equal(result.observed_bytes, 6);
  assert.equal(result.stored_bytes, 4);
  assert.equal(result.truncated, true);
  assert.equal(result.buffer.toString(), "abcd");
});

test("redaction removes key and value secrets", () => {
  const result = redactRecord({
    password: "visible",
    arguments: [
      "--token=secret-value"
    ],
    safe: "hello"
  });

  assert.equal(
    result.value.password,
    "[REDACTED]"
  );

  assert.equal(
    result.value.arguments[0],
    "[REDACTED]"
  );

  assert.equal(result.value.safe, "hello");
  assert.ok(result.redactions.length >= 2);
});

test("environment capture stores hashes, not raw values", () => {
  const facts = snapshotEnvironment({
    SAFE_VALUE: "hello",
    API_TOKEN: "super-secret"
  });

  const safe = facts.find(
    (fact) => fact.name === "SAFE_VALUE"
  );

  const token = facts.find(
    (fact) => fact.name === "API_TOKEN"
  );

  assert.ok(safe);
  assert.ok(token);

  assert.equal(safe.value_sha256.length, 64);
  assert.equal(token.value_sha256.length, 64);
  assert.equal(token.redacted, true);

  assert.equal(
    JSON.stringify(facts).includes(
      "super-secret"
    ),
    false
  );
});

test("file effects detect created and modified files", () => {
  const root = mkdtempSync(
    join(tmpdir(), "invocorder-files-")
  );

  writeFileSync(join(root, "existing.txt"), "one");

  const before = snapshotFiles(root);

  writeFileSync(join(root, "existing.txt"), "two");
  writeFileSync(join(root, "created.txt"), "new");

  const after = snapshotFiles(root);

  const effects = diffFileSnapshots(
    before,
    after
  );

  assert.ok(
    effects.some(
      (effect) =>
        effect.effect === "modified" &&
        effect.path === "existing.txt"
    )
  );

  assert.ok(
    effects.some(
      (effect) =>
        effect.effect === "created" &&
        effect.path === "created.txt"
    )
  );
});

test("process exit normalization preserves failure facts", () => {
  const result = normalizeProcessExit({
    exitCode: 7,
    signal: null,
    spawnError: null
  });

  assert.equal(result.exit_code, 7);
  assert.equal(result.succeeded, false);
  assert.equal(result.interrupted, false);
});

test("CLI run emits valid session with file effects", () => {
  const root = mkdtempSync(
    join(tmpdir(), "invocorder-run-")
  );

  mkdirSync(join(root, "work"));

  const cli = resolve(
    process.cwd(),
    "bin/invocorder.js"
  );

  const child = spawnSync(
    process.execPath,
    [
      cli,
      "run",
      "--",
      process.execPath,
      "-e",
      [
        "const fs=require('fs');",
        "fs.writeFileSync('created.txt','created');",
        "console.log('stdout-value');",
        "console.error('stderr-value');"
      ].join("")
    ],
    {
      cwd: join(root, "work"),
      encoding: "utf8",
      env: {
        ...process.env,
        INVOCORDER_MAX_CAPTURE_BYTES: "1024"
      }
    }
  );

  assert.equal(child.status, 0);

  const sessionsRoot = join(
    root,
    "work",
    ".invocorder",
    "sessions"
  );

  const sessions = readdirSync(
    sessionsRoot
  );

  assert.equal(sessions.length, 1);

  const sessionRoot = join(
    sessionsRoot,
    sessions[0]
  );

  const records = readFileSync(
    join(
      sessionRoot,
      "records.jsonl"
    ),
    "utf8"
  )
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  const exitRecord = records.find(
    (record) =>
      record.boundary.kind === "process" &&
      record.boundary.name === "exit"
  );

  assert.ok(exitRecord);

  assert.ok(
    exitRecord.effects.some(
      (effect: {
        effect: string;
        path: string;
      }) =>
        effect.effect === "created" &&
        effect.path === "created.txt"
    )
  );

  const integrity = JSON.parse(
    readFileSync(
      join(
        sessionRoot,
        "bundle-integrity-result.json"
      ),
      "utf8"
    )
  );

  assert.equal(integrity.valid, true);
});


test("CLI records generic boundary JSONL", () => {
  const root = mkdtempSync(
    join(tmpdir(), "invocorder-jsonl-")
  );

  const inputPath = join(
    root,
    "browser-events.jsonl"
  );

  writeFileSync(
    inputPath,
    JSON.stringify({
      direction: "effect",
      type: "navigation",
      url: "https://example.invalid"
    }) + "\n"
  );

  const cli = resolve(
    process.cwd(),
    "bin/invocorder.js"
  );

  const child = spawnSync(
    process.execPath,
    [
      cli,
      "record-jsonl",
      "browser",
      inputPath,
      "browser-event"
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: process.env
    }
  );

  assert.equal(
    child.status,
    0,
    child.stdout + child.stderr
  );

  const result = JSON.parse(child.stdout);

  assert.equal(
    result.status,
    "INVOCORDER_BOUNDARY_JSONL_CAPTURE_VALID"
  );

  assert.equal(result.valid, true);

  // ZERO_OMISSION_EXTERNAL_VERIFICATION
  const omissionArtifactPath = join(
    root,
    result.session_dir,
    "omissions.jsonl"
  );

  assert.equal(
    readFileSync(
      omissionArtifactPath,
      "utf8"
    ),
    ""
  );

  const externalVerification = spawnSync(
    process.execPath,
    [
      cli,
      "verify-bundle",
      join(
        root,
        result.session_dir,
        "replay-bundle.json"
      )
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: process.env
    }
  );

  assert.equal(
    externalVerification.status,
    0,
    externalVerification.stdout +
      externalVerification.stderr
  );

  assert.equal(
    JSON.parse(
      externalVerification.stdout
    ).valid,
    true
  );

  const records = readFileSync(
    join(
      root,
      result.session_dir,
      "records.jsonl"
    ),
    "utf8"
  )
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  assert.equal(records.length, 1);
  assert.equal(
    records[0].boundary.kind,
    "browser"
  );
  assert.equal(
    records[0].boundary.name,
    "browser-event"
  );
  assert.equal(
    records[0].boundary.direction,
    "effect"
  );
});
