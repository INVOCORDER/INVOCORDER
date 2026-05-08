import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ActionSession } from "./start-session.js";

export function closeSession(sessionDir: string): ActionSession {
  const path = join(sessionDir, "session.json");
  const session = JSON.parse(readFileSync(path, "utf8")) as ActionSession;
  session.closed_at = new Date().toISOString();
  writeFileSync(path, JSON.stringify(session, null, 2) + "\n");
  return session;
}
