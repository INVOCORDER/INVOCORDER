import {
  DEFAULT_REDACTION_POLICY,
  type RedactionPolicy
} from "./load-redaction-policy.js";

export interface RedactionEvent {
  path: string;
  reason: "key-pattern" | "value-pattern";
}

export interface RedactionResult<T> {
  value: T;
  redactions: RedactionEvent[];
}

function compilePatterns(patterns: string[]): RegExp[] {
  return patterns.map((pattern) => {
    try {
      return new RegExp(pattern, "i");
    } catch {
      throw new Error(
        `invalid redaction regular expression: ${pattern}`
      );
    }
  });
}

export function redactRecord<T>(
  input: T,
  policy: RedactionPolicy = DEFAULT_REDACTION_POLICY
): RedactionResult<T> {
  const keyPatterns = compilePatterns(policy.key_patterns);
  const valuePatterns = compilePatterns(
    policy.value_patterns
  );

  const redactions: RedactionEvent[] = [];

  function visit(
    value: unknown,
    path: string,
    key?: string
  ): unknown {
    if (
      key &&
      keyPatterns.some((pattern) => pattern.test(key))
    ) {
      redactions.push({
        path,
        reason: "key-pattern"
      });

      return policy.replacement;
    }

    if (typeof value === "string") {
      if (
        valuePatterns.some((pattern) =>
          pattern.test(value)
        )
      ) {
        redactions.push({
          path,
          reason: "value-pattern"
        });

        return policy.replacement;
      }

      return value;
    }

    if (Array.isArray(value)) {
      return value.map((entry, index) =>
        visit(entry, `${path}[${index}]`)
      );
    }

    if (
      value !== null &&
      typeof value === "object" &&
      !Buffer.isBuffer(value)
    ) {
      const output: Record<string, unknown> = {};

      for (
        const [entryKey, entryValue] of
        Object.entries(
          value as Record<string, unknown>
        )
      ) {
        const entryPath = path
          ? `${path}.${entryKey}`
          : entryKey;

        output[entryKey] = visit(
          entryValue,
          entryPath,
          entryKey
        );
      }

      return output;
    }

    return value;
  }

  return {
    value: visit(input, "$") as T,
    redactions
  };
}
