import { readFileSync, writeFileSync } from "node:fs";
import { startSession } from "../capture/start-session.js";
import { createBoundaryRecord } from "../capture/record-boundary-fact.js";
import { writeRecord } from "../capture/write-record.js";
import { closeSession } from "../capture/close-session.js";
import { createOmissionRecord } from "../omission/create-omission-record.js";
import { compileReplayBundle } from "../bundle/compile-replay-bundle.js";
import { verifyReplayBundle } from "../bundle/verify-replay-bundle.js";
import { join } from "node:path";

export async function recordMcpStdioFile(path: string): Promise<void> {
  const { session, sessionDir } = startSession();
  const raw = readFileSync(path, "utf8");

  let previous: string | null = null;
  let sequence = 1;

  const lines = raw.split("\n").filter(Boolean);

  for (const line of lines) {
    let direction: "request" | "response" | "omission" = "request";
    let omission = null;

    try {
      const parsed = JSON.parse(line);
      if (Object.prototype.hasOwnProperty.call(parsed, "result") || Object.prototype.hasOwnProperty.call(parsed, "error")) {
        direction = "response";
      }
      if (!Object.prototype.hasOwnProperty.call(parsed, "jsonrpc")) {
        direction = "omission";
        omission = createOmissionRecord(session.session_id, "MCP frame missing jsonrpc field");
      }
    } catch {
      direction = "omission";
      omission = createOmissionRecord(session.session_id, "malformed MCP JSON frame");
    }

    if (omission) {
      writeFileSync(join(sessionDir, "omissions.jsonl"), JSON.stringify(omission) + "\n", { flag: "a" });
    }

    const record = createBoundaryRecord({
      session_id: session.session_id,
      sequence: sequence++,
      boundary: { kind: "mcp", name: "mcp-stdio-frame", direction },
      payload: line,
      previous_record_hash: previous,
      omissions: omission ? [omission] : []
    });

    writeRecord(sessionDir, record);
    previous = record.record_hash;
  }

  if (lines.length === 0) {
    const omission = createOmissionRecord(session.session_id, "empty MCP stdio input");
    writeFileSync(join(sessionDir, "omissions.jsonl"), JSON.stringify(omission) + "\n", { flag: "a" });

    const record = createBoundaryRecord({
      session_id: session.session_id,
      sequence: sequence++,
      boundary: { kind: "mcp", name: "mcp-stdio-frame", direction: "omission" },
      payload: "",
      previous_record_hash: previous,
      omissions: [omission]
    });

    writeRecord(sessionDir, record);
  }

  closeSession(sessionDir);
  compileReplayBundle(sessionDir, session.session_id);
  const integrity = verifyReplayBundle(sessionDir, session.session_id);

  console.error(`INVOCORDER MCP session: ${sessionDir}`);
  console.error(`INVOCORDER MCP integrity: ${integrity.valid ? "valid" : "invalid"}`);
}
