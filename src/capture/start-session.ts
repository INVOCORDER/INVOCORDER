import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { readRecorderVersion } from "../version.js";

export type ActionSession = {
  object_type: "INVOCORDER_ACTION_SESSION";
  schema_version: "0.1.0";
  capture_contract_version: "0.1.0";
  session_id: string;
  started_at: string;
  closed_at: string | null;
  recorder: {
    name: "invocorder";
    version: string;
  };
};

export function startSession(root = ".invocorder/sessions"): { session: ActionSession; sessionDir: string } {
  const sessionId = `act_${randomUUID()}`;
  const sessionDir = join(root, sessionId);
  mkdirSync(sessionDir, { recursive: true });

  const session: ActionSession = {
    object_type: "INVOCORDER_ACTION_SESSION",
    schema_version: "0.1.0",
    capture_contract_version: "0.1.0",
    session_id: sessionId,
    started_at: new Date().toISOString(),
    closed_at: null,
    recorder: {
      name: "invocorder",
      version: readRecorderVersion()
    }
  };

  writeFileSync(join(sessionDir, "session.json"), JSON.stringify(session, null, 2) + "\n");
  return { session, sessionDir };
}
