import { readFileSync } from "node:fs";

export interface RedactionPolicy {
  key_patterns: string[];
  value_patterns: string[];
  replacement: string;
  max_capture_bytes: number;
  environment_allow: string[];
  environment_deny: string[];
}

export const DEFAULT_REDACTION_POLICY: RedactionPolicy = {
  key_patterns: [
    "authorization",
    "cookie",
    "password",
    "passwd",
    "secret",
    "token",
    "api[_-]?key",
    "private[_-]?key",
    "client[_-]?secret"
  ],
  value_patterns: [
    "gho_[A-Za-z0-9_]+",
    "ghp_[A-Za-z0-9_]+",
    "github_pat_[A-Za-z0-9_]+",
    "sk-[A-Za-z0-9_-]+",
    "(?:token|password|secret|api[_-]?key)=[^\\s]+"
  ],
  replacement: "[REDACTED]",
  max_capture_bytes: 1024 * 1024,
  environment_allow: [],
  environment_deny: [
    "authorization",
    "cookie",
    "password",
    "passwd",
    "secret",
    "token",
    "api[_-]?key",
    "private[_-]?key",
    "client[_-]?secret"
  ]
};

function requireStringArray(
  value: unknown,
  name: string
): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }

  if (!value.every((entry) => typeof entry === "string")) {
    throw new Error(`${name} must contain only strings`);
  }

  return value;
}

export function loadRedactionPolicy(
  path?: string
): RedactionPolicy {
  if (!path) {
    return {
      ...DEFAULT_REDACTION_POLICY,
      key_patterns: [...DEFAULT_REDACTION_POLICY.key_patterns],
      value_patterns: [...DEFAULT_REDACTION_POLICY.value_patterns],
      environment_allow: [
        ...DEFAULT_REDACTION_POLICY.environment_allow
      ],
      environment_deny: [
        ...DEFAULT_REDACTION_POLICY.environment_deny
      ]
    };
  }

  const parsed = JSON.parse(
    readFileSync(path, "utf8")
  ) as Record<string, unknown>;

  const maxCaptureBytes =
    typeof parsed.max_capture_bytes === "number"
      ? parsed.max_capture_bytes
      : DEFAULT_REDACTION_POLICY.max_capture_bytes;

  if (
    !Number.isInteger(maxCaptureBytes) ||
    maxCaptureBytes <= 0
  ) {
    throw new Error(
      "max_capture_bytes must be a positive integer"
    );
  }

  return {
    key_patterns: parsed.key_patterns
      ? requireStringArray(
          parsed.key_patterns,
          "key_patterns"
        )
      : [...DEFAULT_REDACTION_POLICY.key_patterns],

    value_patterns: parsed.value_patterns
      ? requireStringArray(
          parsed.value_patterns,
          "value_patterns"
        )
      : [...DEFAULT_REDACTION_POLICY.value_patterns],

    replacement:
      typeof parsed.replacement === "string"
        ? parsed.replacement
        : DEFAULT_REDACTION_POLICY.replacement,

    max_capture_bytes: maxCaptureBytes,

    environment_allow: parsed.environment_allow
      ? requireStringArray(
          parsed.environment_allow,
          "environment_allow"
        )
      : [...DEFAULT_REDACTION_POLICY.environment_allow],

    environment_deny: parsed.environment_deny
      ? requireStringArray(
          parsed.environment_deny,
          "environment_deny"
        )
      : [...DEFAULT_REDACTION_POLICY.environment_deny]
  };
}
