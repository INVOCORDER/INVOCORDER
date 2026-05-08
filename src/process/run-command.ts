import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { startSession } from "../capture/start-session.js";
import { createBoundaryRecord } from "../capture/record-boundary-fact.js";
import { writeRecord } from "../capture/write-record.js";
import { closeSession } from "../capture/close-session.js";
import { createOmissionRecord } from "../omission/create-omission-record.js";
import { compileReplayBundle } from "../bundle/compile-replay-bundle.js";
import { verifyReplayBundle } from "../bundle/verify-replay-bundle.js";

export async function runCommand(command: string, args: string[]): Promise<void> {
  const { session, sessionDir } = startSession();

  let sequence = 1;
  let previous: string | null = null;

  const requestRecord = createBoundaryRecord({
    session_id: session.session_id,
    sequence: sequence++,
    boundary: { kind: "process", name: command, direction: "request" },
    payload: JSON.stringify({ command, args }),
    previous_record_hash: previous
  });
  writeRecord(sessionDir, requestRecord);
  previous = requestRecord.record_hash;

  const child = spawn(command, args, { stdio: ["inherit", "pipe", "pipe"] });

  let stdout = Buffer.from("");
  let stderr = Buffer.from("");

  child.stdout.on("data", (chunk: Buffer) => {
    stdout = Buffer.concat([stdout, chunk]);
    process.stdout.write(chunk);
  });

  child.stderr.on("data", (chunk: Buffer) => {
    stderr = Buffer.concat([stderr, chunk]);
    process.stderr.write(chunk);
  });

  const exitCode = await new Promise<number | null>((resolve) => {
    child.on("close", resolve);
  });

  const stdoutRecord = createBoundaryRecord({
    session_id: session.session_id,
    sequence: sequence++,
    boundary: { kind: "stdio", name: "stdout", direction: "response" },
    payload: stdout,
    previous_record_hash: previous
  });
  writeRecord(sessionDir, stdoutRecord);
  previous = stdoutRecord.record_hash;

  const stderrRecord = createBoundaryRecord({
    session_id: session.session_id,
    sequence: sequence++,
    boundary: { kind: "stdio", name: "stderr", direction: "response" },
    payload: stderr,
    previous_record_hash: previous
  });
  writeRecord(sessionDir, stderrRecord);
  previous = stderrRecord.record_hash;

  const omission = createOmissionRecord(session.session_id, "file effects not captured in v0.1 local process recorder");
  writeFileSync(join(sessionDir, "omissions.jsonl"), JSON.stringify(omission) + "\n");

  const exitRecord = createBoundaryRecord({
    session_id: session.session_id,
    sequence: sequence++,
    boundary: { kind: "process", name: "exit", direction: "effect" },
    payload: JSON.stringify({ exitCode }),
    previous_record_hash: previous,
    omissions: [omission]
  });
  writeRecord(sessionDir, exitRecord);

  closeSession(sessionDir);
  compileReplayBundle(sessionDir, session.session_id);
  const integrity = verifyReplayBundle(sessionDir, session.session_id);

  console.error(`\nINVOCORDER session: ${sessionDir}`);
  console.error(`INVOCORDER integrity: ${integrity.valid ? "valid" : "invalid"}`);

  process.exit(exitCode ?? 1);
}
