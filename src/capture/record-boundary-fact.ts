import { randomUUID } from "node:crypto";
import { hashRecord, sha256 } from "../hash/hash-record.js";

export type MachineActionRecord = {
  object_type: "INVOCORDER_MACHINE_ACTION_RECORD";
  schema_version: "0.1.0";
  capture_contract_version: "0.1.0";
  session_id: string;
  record_id: string;
  sequence: number;
  timestamp: string;
  boundary: {
    kind: "process" | "stdio" | "mcp" | "http" | "shell" | "file" | "browser" | "desktop" | "api";
    name: string;
    direction: "request" | "response" | "effect" | "omission";
  };
  actor: {
    agent: string;
    client: string;
    model: string;
    operator: string;
  };
  payload: {
    present: boolean;
    stored: boolean;
    sha256: string;
    size_bytes: number;
    media_type: string;
    redacted: boolean;
  };
  effects: unknown[];
  omissions: unknown[];
  previous_record_hash: string | null;
  record_hash: string;
};

export function createBoundaryRecord(input: {
  session_id: string;
  sequence: number;
  boundary: MachineActionRecord["boundary"];
  payload: string | Buffer;
  previous_record_hash: string | null;
  omissions?: unknown[];
  effects?: unknown[];
}): MachineActionRecord {
  const payloadBuffer = Buffer.isBuffer(input.payload) ? input.payload : Buffer.from(input.payload);

  const record: MachineActionRecord = {
    object_type: "INVOCORDER_MACHINE_ACTION_RECORD",
    schema_version: "0.1.0",
    capture_contract_version: "0.1.0",
    session_id: input.session_id,
    record_id: `rec_${randomUUID()}`,
    sequence: input.sequence,
    timestamp: new Date().toISOString(),
    boundary: input.boundary,
    actor: {
      agent: "unknown",
      client: "invocorder",
      model: "unknown",
      operator: "unknown"
    },
    payload: {
      present: payloadBuffer.length > 0,
      stored: false,
      sha256: sha256(payloadBuffer),
      size_bytes: payloadBuffer.length,
      media_type: "text/plain",
      redacted: false
    },
    effects: input.effects ?? [],
    omissions: input.omissions ?? [],
    previous_record_hash: input.previous_record_hash,
    record_hash: ""
  };

  record.record_hash = hashRecord(record as unknown as Record<string, unknown>);
  return record;
}
