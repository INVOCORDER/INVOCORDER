export interface CapturedStdio {
  buffer: Buffer;
  observed_bytes: number;
  stored_bytes: number;
  truncated: boolean;
  limit_bytes: number;
}

export interface BoundedCapture {
  push(chunk: Buffer | string): void;
  finish(): CapturedStdio;
}

export function createBoundedCapture(limitBytes = 1024 * 1024): BoundedCapture {
  if (!Number.isInteger(limitBytes) || limitBytes <= 0) {
    throw new Error("limitBytes must be a positive integer");
  }

  const chunks: Buffer[] = [];
  let observedBytes = 0;
  let storedBytes = 0;
  let truncated = false;

  return {
    push(chunk: Buffer | string): void {
      const buffer = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk);

      observedBytes += buffer.length;

      const remaining = limitBytes - storedBytes;

      if (remaining <= 0) {
        truncated = true;
        return;
      }

      if (buffer.length > remaining) {
        chunks.push(buffer.subarray(0, remaining));
        storedBytes += remaining;
        truncated = true;
        return;
      }

      chunks.push(buffer);
      storedBytes += buffer.length;
    },

    finish(): CapturedStdio {
      return {
        buffer: Buffer.concat(chunks),
        observed_bytes: observedBytes,
        stored_bytes: storedBytes,
        truncated,
        limit_bytes: limitBytes
      };
    }
  };
}
