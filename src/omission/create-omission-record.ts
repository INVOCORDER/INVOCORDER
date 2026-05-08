import { randomUUID } from "node:crypto";

export type OmissionRecord = {
  object_type: "INVOCORDER_OMISSION_RECORD";
  schema_version: "0.1.0";
  session_id: string;
  omission_id: string;
  reason: string;
  declared_at: string;
};

export function createOmissionRecord(session_id: string, reason: string): OmissionRecord {
  return {
    object_type: "INVOCORDER_OMISSION_RECORD",
    schema_version: "0.1.0",
    session_id,
    omission_id: `om_${randomUUID()}`,
    reason,
    declared_at: new Date().toISOString()
  };
}
