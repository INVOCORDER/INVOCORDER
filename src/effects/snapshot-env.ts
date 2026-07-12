import { createHash } from "node:crypto";

import {
  DEFAULT_REDACTION_POLICY,
  type RedactionPolicy
} from "../redaction/load-redaction-policy.js";

export interface EnvironmentFact {
  name: string;
  present: boolean;
  value_sha256: string;
  size_bytes: number;
  redacted: boolean;
  classification: "hashed" | "secret-like";
}

function sha256(value: string): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function compile(patterns: string[]): RegExp[] {
  return patterns.map((pattern) => {
    try {
      return new RegExp(pattern, "i");
    } catch {
      throw new Error(
        `invalid environment pattern: ${pattern}`
      );
    }
  });
}

export function snapshotEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  policy: RedactionPolicy = DEFAULT_REDACTION_POLICY
): EnvironmentFact[] {
  const allow = new Set(policy.environment_allow);
  const denyPatterns = compile(policy.environment_deny);

  return Object.keys(environment)
    .sort()
    .filter((name) => {
      if (allow.size === 0) {
        return true;
      }

      return allow.has(name);
    })
    .map((name) => {
      const value = environment[name] ?? "";
      const secretLike = denyPatterns.some(
        (pattern) => pattern.test(name)
      );

      return {
        name,
        present: environment[name] !== undefined,
        value_sha256: sha256(value),
        size_bytes: Buffer.byteLength(value),
        redacted: secretLike,
        classification: secretLike
          ? "secret-like"
          : "hashed"
      };
    });
}
