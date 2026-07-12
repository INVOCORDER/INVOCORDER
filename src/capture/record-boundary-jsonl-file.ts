import {
  appendFileSync,
  readFileSync
} from "node:fs";
import { join } from "node:path";

import { compileReplayBundle } from "../bundle/compile-replay-bundle.js";
import { verifyReplayBundle } from "../bundle/verify-replay-bundle.js";
import { createOmissionRecord } from "../omission/create-omission-record.js";
import { closeSession } from "./close-session.js";
import {
  createBoundaryRecord,
  type MachineActionRecord
} from "./record-boundary-fact.js";
import { startSession } from "./start-session.js";
import { writeRecord } from "./write-record.js";

export type BoundaryKind =
  MachineActionRecord["boundary"]["kind"];

export interface BoundaryJsonlResult {
  session_dir: string;
  session_id: string;
  record_count: number;
  omission_count: number;
  valid: boolean;
}

const VALID_KINDS = new Set<BoundaryKind>([
  "process",
  "stdio",
  "mcp",
  "http",
  "shell",
  "file",
  "browser",
  "desktop",
  "api"
]);

const VALID_DIRECTIONS = new Set<
  MachineActionRecord["boundary"]["direction"]
>([
  "request",
  "response",
  "effect",
  "omission"
]);

export async function recordBoundaryJsonlFile(
  path: string,
  kind: BoundaryKind,
  name = "jsonl-frame"
): Promise<BoundaryJsonlResult> {
  if (!VALID_KINDS.has(kind)) {
    throw new Error(`unsupported boundary kind: ${kind}`);
  }

  const { session, sessionDir } = startSession();
  const raw = readFileSync(path, "utf8");
  const lines = raw.split("\n").filter(Boolean);

  let sequence = 1;
  let previous: string | null = null;
  let omissionCount = 0;

  for (const line of lines) {
    let direction:
      MachineActionRecord["boundary"]["direction"] =
      "effect";

    const omissions: unknown[] = [];

    try {
      const parsed = JSON.parse(line) as {
        direction?: unknown;
      };

      if (
        typeof parsed.direction === "string" &&
        VALID_DIRECTIONS.has(
          parsed.direction as
            MachineActionRecord["boundary"]["direction"]
        )
      ) {
        direction =
          parsed.direction as
            MachineActionRecord["boundary"]["direction"];
      }
    } catch {
      direction = "omission";

      const omission = createOmissionRecord(
        session.session_id,
        `malformed ${kind} JSONL frame`
      );

      omissions.push(omission);
      omissionCount += 1;

      appendFileSync(
        join(sessionDir, "omissions.jsonl"),
        JSON.stringify(omission) + "\n"
      );
    }

    const record = createBoundaryRecord({
      session_id: session.session_id,
      sequence: sequence++,
      boundary: {
        kind,
        name,
        direction
      },
      payload: line,
      previous_record_hash: previous,
      omissions
    });

    writeRecord(sessionDir, record);
    previous = record.record_hash;
  }

  if (lines.length === 0) {
    const omission = createOmissionRecord(
      session.session_id,
      `empty ${kind} JSONL input`
    );

    omissionCount += 1;

    appendFileSync(
      join(sessionDir, "omissions.jsonl"),
      JSON.stringify(omission) + "\n"
    );

    const record = createBoundaryRecord({
      session_id: session.session_id,
      sequence: sequence++,
      boundary: {
        kind,
        name,
        direction: "omission"
      },
      payload: "",
      previous_record_hash: previous,
      omissions: [omission]
    });

    writeRecord(sessionDir, record);
  }

  closeSession(sessionDir);
  compileReplayBundle(sessionDir, session.session_id);

  const integrity = verifyReplayBundle(
    sessionDir,
    session.session_id
  );

  return {
    session_dir: sessionDir,
    session_id: session.session_id,
    record_count: Math.max(lines.length, 1),
    omission_count: omissionCount,
    valid: integrity.valid
  };
}
