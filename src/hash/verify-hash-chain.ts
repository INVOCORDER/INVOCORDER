import { hashRecord } from "./hash-record.js";

export type HashChainRecord = {
  sequence: number;
  previous_record_hash: string | null;
  record_hash: string;
  [key: string]: unknown;
};

export function verifyHashChain(records: HashChainRecord[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  let previous: string | null = null;

  records.forEach((record, index) => {
    if (record.sequence !== index + 1) {
      errors.push(`sequence mismatch at index ${index}`);
    }

    if (record.previous_record_hash !== previous) {
      errors.push(`previous hash mismatch at sequence ${record.sequence}`);
    }

    const expected = hashRecord(record as Record<string, unknown>);
    if (record.record_hash !== expected) {
      errors.push(`record hash mismatch at sequence ${record.sequence}`);
    }

    previous = record.record_hash;
  });

  return { valid: errors.length === 0, errors };
}
