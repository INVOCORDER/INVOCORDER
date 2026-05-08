import { appendFileSync } from "node:fs";
import { join } from "node:path";
import type { MachineActionRecord } from "./record-boundary-fact.js";

export function writeRecord(sessionDir: string, record: MachineActionRecord): void {
  appendFileSync(join(sessionDir, "records.jsonl"), JSON.stringify(record) + "\n");
}
