import {
  appendFileSync
} from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

import { compileReplayBundle } from "../bundle/compile-replay-bundle.js";
import { verifyReplayBundle } from "../bundle/verify-replay-bundle.js";
import { closeSession } from "../capture/close-session.js";
import { createBoundaryRecord } from "../capture/record-boundary-fact.js";
import { startSession } from "../capture/start-session.js";
import { writeRecord } from "../capture/write-record.js";
import {
  diffFileSnapshots,
  snapshotFiles
} from "../effects/scan-file-effects.js";
import { snapshotEnvironment } from "../effects/snapshot-env.js";
import { createOmissionRecord } from "../omission/create-omission-record.js";
import { loadRedactionPolicy } from "../redaction/load-redaction-policy.js";
import { redactRecord } from "../redaction/redact-record.js";
import { normalizeProcessExit } from "./capture-exit.js";
import { createBoundedCapture } from "./capture-stdio.js";

export async function runCommand(
  command: string,
  args: string[]
): Promise<void> {
  const { session, sessionDir } = startSession();

  const policy = loadRedactionPolicy(
    process.env.INVOCORDER_REDACTION_POLICY
  );

  const requestedCaptureLimit = Number(
    process.env.INVOCORDER_MAX_CAPTURE_BYTES ??
      policy.max_capture_bytes
  );

  const captureLimit =
    Number.isInteger(requestedCaptureLimit) &&
    requestedCaptureLimit > 0
      ? requestedCaptureLimit
      : policy.max_capture_bytes;

  const environmentFacts = snapshotEnvironment(
    process.env,
    policy
  );

  const filesBefore = snapshotFiles(process.cwd());

  let sequence = 1;
  let previous: string | null = null;

  const redactedRequest = redactRecord(
    {
      command,
      args
    },
    policy
  );

  const requestRecord = createBoundaryRecord({
    session_id: session.session_id,
    sequence: sequence++,
    boundary: {
      kind: "process",
      name: command,
      direction: "request"
    },
    payload: JSON.stringify(redactedRequest.value),
    previous_record_hash: previous,
    effects: [
      {
        object_type:
          "INVOCORDER_ENVIRONMENT_SNAPSHOT",
        facts: environmentFacts
      },
      {
        object_type:
          "INVOCORDER_REDACTION_RESULT",
        redactions: redactedRequest.redactions
      }
    ]
  });

  writeRecord(sessionDir, requestRecord);
  previous = requestRecord.record_hash;

  const stdoutCapture =
    createBoundedCapture(captureLimit);

  const stderrCapture =
    createBoundedCapture(captureLimit);

  const spawnState: {
    error: Error | null;
  } = {
    error: null
  };

  const child = spawn(command, args, {
    stdio: ["inherit", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk: Buffer) => {
    stdoutCapture.push(chunk);
    process.stdout.write(chunk);
  });

  child.stderr.on("data", (chunk: Buffer) => {
    stderrCapture.push(chunk);
    process.stderr.write(chunk);
  });

  const outcome = await new Promise<{
    exitCode: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) => {
    let settled = false;

    function finish(
      exitCode: number | null,
      signal: NodeJS.Signals | null
    ): void {
      if (settled) {
        return;
      }

      settled = true;

      resolve({
        exitCode,
        signal
      });
    }

    child.once("error", (error) => {
      spawnState.error = error;
      finish(null, null);
    });

    child.once("close", (exitCode, signal) => {
      finish(exitCode, signal);
    });
  });

  const stdout = stdoutCapture.finish();
  const stderr = stderrCapture.finish();

  const filesAfter = snapshotFiles(process.cwd());

  const fileEffects = diffFileSnapshots(
    filesBefore,
    filesAfter
  );

  const omissionMessages = [
    ...filesBefore.omissions.map(
      (message) => `pre-execution ${message}`
    ),
    ...filesAfter.omissions.map(
      (message) => `post-execution ${message}`
    )
  ];

  if (stdout.truncated) {
    omissionMessages.push(
      `stdout truncated: observed=${stdout.observed_bytes} stored=${stdout.stored_bytes}`
    );
  }

  if (stderr.truncated) {
    omissionMessages.push(
      `stderr truncated: observed=${stderr.observed_bytes} stored=${stderr.stored_bytes}`
    );
  }

  if (spawnState.error) {
    omissionMessages.push(
      `spawn failed: ${spawnState.error.message}`
    );
  }

  const omissionRecords = omissionMessages.map(
    (message) =>
      createOmissionRecord(
        session.session_id,
        message
      )
  );

  for (const omission of omissionRecords) {
    appendFileSync(
      join(sessionDir, "omissions.jsonl"),
      JSON.stringify(omission) + "\n"
    );
  }

  const stdoutRecord = createBoundaryRecord({
    session_id: session.session_id,
    sequence: sequence++,
    boundary: {
      kind: "stdio",
      name: "stdout",
      direction: "response"
    },
    payload: stdout.buffer,
    previous_record_hash: previous,
    effects: [
      {
        object_type:
          "INVOCORDER_STDIO_CAPTURE_METADATA",
        stream: "stdout",
        observed_bytes: stdout.observed_bytes,
        stored_bytes: stdout.stored_bytes,
        truncated: stdout.truncated,
        limit_bytes: stdout.limit_bytes
      }
    ],
    omissions: stdout.truncated
      ? omissionRecords.filter((record) =>
          JSON.stringify(record).includes(
            "stdout truncated"
          )
        )
      : []
  });

  writeRecord(sessionDir, stdoutRecord);
  previous = stdoutRecord.record_hash;

  const stderrRecord = createBoundaryRecord({
    session_id: session.session_id,
    sequence: sequence++,
    boundary: {
      kind: "stdio",
      name: "stderr",
      direction: "response"
    },
    payload: stderr.buffer,
    previous_record_hash: previous,
    effects: [
      {
        object_type:
          "INVOCORDER_STDIO_CAPTURE_METADATA",
        stream: "stderr",
        observed_bytes: stderr.observed_bytes,
        stored_bytes: stderr.stored_bytes,
        truncated: stderr.truncated,
        limit_bytes: stderr.limit_bytes
      }
    ],
    omissions: stderr.truncated
      ? omissionRecords.filter((record) =>
          JSON.stringify(record).includes(
            "stderr truncated"
          )
        )
      : []
  });

  writeRecord(sessionDir, stderrRecord);
  previous = stderrRecord.record_hash;

  const exit = normalizeProcessExit({
    exitCode: outcome.exitCode,
    signal: outcome.signal,
    spawnError: spawnState.error
  });

  const exitRecord = createBoundaryRecord({
    session_id: session.session_id,
    sequence: sequence++,
    boundary: {
      kind: "process",
      name: "exit",
      direction: "effect"
    },
    payload: JSON.stringify(exit),
    previous_record_hash: previous,
    effects: fileEffects,
    omissions: omissionRecords
  });

  writeRecord(sessionDir, exitRecord);

  closeSession(sessionDir);
  compileReplayBundle(sessionDir, session.session_id);

  const integrity = verifyReplayBundle(
    sessionDir,
    session.session_id
  );

  console.error(
    `\nINVOCORDER session: ${sessionDir}`
  );

  console.error(
    `INVOCORDER integrity: ${
      integrity.valid ? "valid" : "invalid"
    }`
  );

  process.exitCode =
    exit.exit_code ??
    (exit.succeeded ? 0 : 1);
}
