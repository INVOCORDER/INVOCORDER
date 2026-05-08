import { createHash } from "node:crypto";

export function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

export function hashRecord(record: Record<string, unknown>): string {
  const clone = { ...record };
  delete clone.record_hash;
  return sha256(JSON.stringify(clone));
}
