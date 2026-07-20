import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from "node:fs";
import {
  basename,
  dirname,
  join,
  resolve
} from "node:path";

import {
  readRecorderVersion
} from "../version.js";

type JsonObject = Record<string, unknown>;

export interface SessionTimelineEntry {
  sequence: number | null;
  kind: string;
  name: string;
  direction: string;
  record_hash_prefix: string | null;
}

export interface SessionFileEffect {
  effect: string;
  path: string;
}

export interface SessionSummary {
  schema: "invocorder.product.session_summary.v1";
  status:
    | "INVOCORDER_SESSION_VERIFIED"
    | "INVOCORDER_SESSION_RECORDED_FAILURE"
    | "INVOCORDER_SESSION_INTEGRITY_INVALID";
  session_id: string;
  session_dir: string;
  command: string;
  exit_code: number | null;
  succeeded: boolean | null;
  integrity_valid: boolean;
  record_count: number;
  omission_count: number;
  file_effect_count: number;
  file_effects: SessionFileEffect[];
  redaction_count: number;
  artifact_count: number;
  started_at: string | null;
  closed_at: string | null;
  duration_ms: number | null;
  replay_bundle_path: string;
  report_path?: string;
  timeline: SessionTimelineEntry[];
  non_claims: {
    proves_truth: false;
    proves_safety: false;
    proves_authorization: false;
    proves_admissibility: false;
    proves_external_reality: false;
  };
}

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface DoctorResult {
  schema: "invocorder.product.doctor.v1";
  status:
    | "INVOCORDER_READY"
    | "INVOCORDER_NEEDS_ATTENTION";
  version: string;
  node_version: string;
  working_directory: string;
  checks: DoctorCheck[];
  recommended_command: string;
}

function asObject(
  value: unknown
): JsonObject {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
  )
    ? value as JsonObject
    : {};
}

function readJson(
  path: string
): JsonObject {
  return asObject(
    JSON.parse(
      readFileSync(path, "utf8")
    ) as unknown
  );
}

function readJsonl(
  path: string
): JsonObject[] {
  if (!existsSync(path)) {
    return [];
  }

  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) =>
      asObject(
        JSON.parse(line) as unknown
      )
    );
}

function parsePayload(
  value: unknown
): JsonObject {
  if (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
  ) {
    return value as JsonObject;
  }

  if (typeof value !== "string") {
    return {};
  }

  try {
    return asObject(
      JSON.parse(value) as unknown
    );
  } catch {
    return {};
  }
}

function stringValue(
  value: unknown,
  fallback = ""
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

function numberValue(
  value: unknown
): number | null {
  return (
    typeof value === "number"
    && Number.isFinite(value)
  )
    ? value
    : null;
}

function booleanValue(
  value: unknown
): boolean | null {
  return typeof value === "boolean"
    ? value
    : null;
}

function latestSessionDirectory(
  cwd: string
): string {
  const sessionsRoot = resolve(
    cwd,
    ".invocorder",
    "sessions"
  );

  if (!existsSync(sessionsRoot)) {
    throw new Error(
      "No INVOCORDER sessions found. "
      + "Run: invocorder quickstart"
    );
  }

  const candidates = readdirSync(
    sessionsRoot,
    {
      withFileTypes: true
    }
  )
    .filter((entry) =>
      entry.isDirectory()
    )
    .map((entry) =>
      resolve(
        sessionsRoot,
        entry.name
      )
    )
    .filter((path) =>
      existsSync(
        join(
          path,
          "replay-bundle.json"
        )
      )
    )
    .sort(
      (left, right) =>
        statSync(right).mtimeMs
        - statSync(left).mtimeMs
    );

  if (candidates.length === 0) {
    throw new Error(
      "No complete INVOCORDER sessions found. "
      + "Run: invocorder quickstart"
    );
  }

  return candidates[0];
}

export function resolveSessionDirectory(
  reference = "latest",
  cwd = process.cwd()
): string {
  if (reference === "latest") {
    return latestSessionDirectory(cwd);
  }

  const direct = resolve(
    cwd,
    reference
  );

  if (
    existsSync(direct)
    && basename(direct)
      === "replay-bundle.json"
  ) {
    return dirname(direct);
  }

  if (
    existsSync(direct)
    && existsSync(
      join(
        direct,
        "replay-bundle.json"
      )
    )
  ) {
    return direct;
  }

  const byId = resolve(
    cwd,
    ".invocorder",
    "sessions",
    reference
  );

  if (
    existsSync(byId)
    && existsSync(
      join(
        byId,
        "replay-bundle.json"
      )
    )
  ) {
    return byId;
  }

  throw new Error(
    `INVOCORDER session not found: ${reference}`
  );
}

export function summarizeSession(
  reference = "latest",
  cwd = process.cwd()
): SessionSummary {
  const sessionDir =
    resolveSessionDirectory(
      reference,
      cwd
    );

  const session = readJson(
    join(
      sessionDir,
      "session.json"
    )
  );

  const bundle = readJson(
    join(
      sessionDir,
      "replay-bundle.json"
    )
  );

  const records = readJsonl(
    join(
      sessionDir,
      "records.jsonl"
    )
  );

  const omissions = readJsonl(
    join(
      sessionDir,
      "omissions.jsonl"
    )
  );

  const integrityPath = join(
    sessionDir,
    "bundle-integrity-result.json"
  );

  const integrity =
    existsSync(integrityPath)
      ? readJson(integrityPath)
      : {};

  const requestRecord = records.find(
    (record) => {
      const boundary = asObject(
        record.boundary
      );

      return (
        boundary.kind === "process"
        && boundary.direction === "request"
      );
    }
  );

  const requestPayload = parsePayload(
    requestRecord?.payload
  );

  const commandName = stringValue(
    requestPayload.command
  );

  const commandArgs = Array.isArray(
    requestPayload.args
  )
    ? requestPayload.args.map(
        (value) => String(value)
      )
    : [];

  const firstBoundary = asObject(
    records[0]?.boundary
  );

  const fallbackCommand = [
    stringValue(
      firstBoundary.kind,
      "boundary"
    ),
    stringValue(
      firstBoundary.name,
      "record"
    )
  ].join(":");

  const command = commandName
    ? [
        commandName,
        ...commandArgs
      ].join(" ")
    : fallbackCommand;

  const exitRecord = records.find(
    (record) => {
      const boundary = asObject(
        record.boundary
      );

      return (
        boundary.kind === "process"
        && boundary.name === "exit"
      );
    }
  );

  const exitPayload = parsePayload(
    exitRecord?.payload
  );

  const exitCode = numberValue(
    exitPayload.exit_code
  );

  const succeeded = booleanValue(
    exitPayload.succeeded
  );

  const fileEffects: SessionFileEffect[] = [];
  let redactionCount = 0;

  for (const record of records) {
    const effects = Array.isArray(
      record.effects
    )
      ? record.effects
      : [];

    for (const effectValue of effects) {
      const effect = asObject(
        effectValue
      );

      if (
        typeof effect.effect === "string"
        && typeof effect.path === "string"
      ) {
        fileEffects.push({
          effect: effect.effect,
          path: effect.path
        });
      }

      if (
        effect.object_type
        === "INVOCORDER_REDACTION_RESULT"
      ) {
        redactionCount += Array.isArray(
          effect.redactions
        )
          ? effect.redactions.length
          : 0;
      }
    }
  }

  const startedAt =
    typeof session.started_at === "string"
      ? session.started_at
      : null;

  const closedAt =
    typeof session.closed_at === "string"
      ? session.closed_at
      : null;

  const durationMs =
    startedAt && closedAt
      ? Math.max(
          0,
          Date.parse(closedAt)
          - Date.parse(startedAt)
        )
      : null;

  const integrityValid =
    integrity.valid === true;

  const status =
    !integrityValid
      ? "INVOCORDER_SESSION_INTEGRITY_INVALID"
      : succeeded === false
        ? "INVOCORDER_SESSION_RECORDED_FAILURE"
        : "INVOCORDER_SESSION_VERIFIED";

  const artifacts = Array.isArray(
    bundle.artifacts
  )
    ? bundle.artifacts
    : [];

  const timeline = records.map(
    (
      record
    ): SessionTimelineEntry => {
      const boundary = asObject(
        record.boundary
      );

      const sequence = numberValue(
        record.sequence
      );

      const recordHash =
        typeof record.record_hash === "string"
          ? record.record_hash
          : null;

      return {
        sequence,
        kind: stringValue(
          boundary.kind,
          "unknown"
        ),
        name: stringValue(
          boundary.name,
          "unknown"
        ),
        direction: stringValue(
          boundary.direction,
          "unknown"
        ),
        record_hash_prefix:
          recordHash
            ? recordHash.slice(0, 12)
            : null
      };
    }
  );

  return {
    schema:
      "invocorder.product.session_summary.v1",
    status,
    session_id: stringValue(
      session.session_id,
      stringValue(bundle.session_id)
    ),
    session_dir: sessionDir,
    command,
    exit_code: exitCode,
    succeeded,
    integrity_valid: integrityValid,
    record_count: records.length,
    omission_count: omissions.length,
    file_effect_count: fileEffects.length,
    file_effects: fileEffects,
    redaction_count: redactionCount,
    artifact_count: artifacts.length,
    started_at: startedAt,
    closed_at: closedAt,
    duration_ms: durationMs,
    replay_bundle_path: join(
      sessionDir,
      "replay-bundle.json"
    ),
    timeline,
    non_claims: {
      proves_truth: false,
      proves_safety: false,
      proves_authorization: false,
      proves_admissibility: false,
      proves_external_reality: false
    }
  };
}

function escapeHtml(
  value: unknown
): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderSessionReport(
  reference = "latest",
  outputPath?: string,
  cwd = process.cwd()
): {
  output_path: string;
  summary: SessionSummary;
} {
  const summary = summarizeSession(
    reference,
    cwd
  );

  const resolvedOutput = outputPath
    ? resolve(
        cwd,
        outputPath
      )
    : join(
        summary.session_dir,
        "invocorder-report.html"
      );

  mkdirSync(
    dirname(resolvedOutput),
    {
      recursive: true
    }
  );

  const statusLabel =
    summary.status
    === "INVOCORDER_SESSION_VERIFIED"
      ? "RECORDED + VERIFIED"
      : summary.status
        === "INVOCORDER_SESSION_RECORDED_FAILURE"
        ? "FAILURE RECORDED + VERIFIED"
        : "INTEGRITY INVALID";

  const statusClass =
    !summary.integrity_valid
      ? "danger"
      : summary.succeeded === false
        ? "warning"
        : "success";

  const timelineRows = summary.timeline
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(
            entry.sequence ?? ""
          )}</td>
          <td>${escapeHtml(
            entry.kind
          )}</td>
          <td>${escapeHtml(
            entry.name
          )}</td>
          <td>${escapeHtml(
            entry.direction
          )}</td>
          <td><code>${escapeHtml(
            entry.record_hash_prefix ?? ""
          )}</code></td>
        </tr>
      `
    )
    .join("");

  const fileEffectRows =
    summary.file_effects.length > 0
      ? summary.file_effects
          .map(
            (effect) => `
              <tr>
                <td>${escapeHtml(
                  effect.effect
                )}</td>
                <td><code>${escapeHtml(
                  effect.path
                )}</code></td>
              </tr>
            `
          )
          .join("")
      : `
        <tr>
          <td colspan="2">
            No file changes recorded.
          </td>
        </tr>
      `;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >
  <title>INVOCORDER Evidence Report</title>
  <style>
    :root {
      color-scheme: dark;
      font-family:
        Inter,
        ui-sans-serif,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
      background: #080a0f;
      color: #f5f7fb;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background:
        radial-gradient(
          circle at top right,
          rgba(91, 140, 255, 0.22),
          transparent 34%
        ),
        radial-gradient(
          circle at bottom left,
          rgba(68, 220, 190, 0.11),
          transparent 30%
        ),
        #080a0f;
      color: #f5f7fb;
    }

    main {
      width: min(
        1180px,
        calc(100% - 32px)
      );
      margin: 0 auto;
      padding: 52px 0 76px;
    }

    header {
      display: grid;
      gap: 20px;
      margin-bottom: 30px;
    }

    .eyebrow {
      margin: 0;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #a9b8d6;
    }

    h1 {
      margin: 0;
      max-width: 980px;
      font-size: clamp(
        38px,
        7vw,
        80px
      );
      line-height: 0.96;
      letter-spacing: -0.06em;
    }

    .command {
      margin: 0;
      padding: 18px 20px;
      overflow-wrap: anywhere;
      border: 1px solid #2c3444;
      border-radius: 16px;
      background: rgba(
        16,
        20,
        29,
        0.92
      );
      font-family:
        "SFMono-Regular",
        Consolas,
        "Liberation Mono",
        monospace;
      font-size: 15px;
    }

    .status {
      display: inline-flex;
      width: fit-content;
      align-items: center;
      padding: 9px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.09em;
    }

    .success {
      background:
        rgba(32, 201, 151, 0.14);
      color: #7bf1ca;
      border:
        1px solid
        rgba(32, 201, 151, 0.38);
    }

    .warning {
      background:
        rgba(255, 184, 77, 0.14);
      color: #ffd08a;
      border:
        1px solid
        rgba(255, 184, 77, 0.38);
    }

    .danger {
      background:
        rgba(255, 99, 132, 0.14);
      color: #ff9ab0;
      border:
        1px solid
        rgba(255, 99, 132, 0.38);
    }

    .grid {
      display: grid;
      grid-template-columns:
        repeat(
          auto-fit,
          minmax(180px, 1fr)
        );
      gap: 14px;
      margin: 30px 0;
    }

    .card,
    section {
      border: 1px solid #252c3a;
      border-radius: 18px;
      background:
        rgba(16, 20, 29, 0.86);
      box-shadow:
        0 20px 70px
        rgba(0, 0, 0, 0.26);
    }

    .card {
      padding: 20px;
    }

    .card span {
      display: block;
      margin-bottom: 10px;
      color: #9aa9c7;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .card strong {
      font-size: 30px;
      letter-spacing: -0.045em;
    }

    section {
      margin-top: 18px;
      padding: 24px;
      overflow-x: auto;
    }

    h2 {
      margin: 0 0 16px;
      font-size: 20px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 12px 10px;
      border-bottom:
        1px solid #252c3a;
      text-align: left;
      vertical-align: top;
      font-size: 14px;
    }

    th {
      color: #9aa9c7;
      font-size: 11px;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }

    code {
      color: #c9d7ff;
      font-family:
        "SFMono-Regular",
        Consolas,
        "Liberation Mono",
        monospace;
    }

    .paths {
      display: grid;
      gap: 10px;
    }

    .path {
      padding: 12px 14px;
      overflow-wrap: anywhere;
      border-radius: 12px;
      background: #0c1017;
      color: #c9d7ff;
      font-family:
        "SFMono-Regular",
        Consolas,
        "Liberation Mono",
        monospace;
      font-size: 13px;
    }

    footer {
      margin-top: 26px;
      color: #8c99b3;
      font-size: 13px;
      line-height: 1.65;
    }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="eyebrow">
        INVOCORDER Evidence Report
      </p>
      <h1>
        What ran. What changed.
        What can be replayed.
      </h1>
      <div class="status ${statusClass}">
        ${escapeHtml(statusLabel)}
      </div>
      <p class="command">
        ${escapeHtml(summary.command)}
      </p>
    </header>

    <div class="grid">
      <div class="card">
        <span>Integrity</span>
        <strong>${
          summary.integrity_valid
            ? "Valid"
            : "Invalid"
        }</strong>
      </div>
      <div class="card">
        <span>Exit</span>
        <strong>${escapeHtml(
          summary.exit_code ?? "n/a"
        )}</strong>
      </div>
      <div class="card">
        <span>Records</span>
        <strong>${
          summary.record_count
        }</strong>
      </div>
      <div class="card">
        <span>Omissions</span>
        <strong>${
          summary.omission_count
        }</strong>
      </div>
      <div class="card">
        <span>File effects</span>
        <strong>${
          summary.file_effect_count
        }</strong>
      </div>
      <div class="card">
        <span>Duration</span>
        <strong>${
          summary.duration_ms === null
            ? "n/a"
            : `${summary.duration_ms} ms`
        }</strong>
      </div>
    </div>

    <section>
      <h2>Boundary timeline</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Kind</th>
            <th>Name</th>
            <th>Direction</th>
            <th>Record hash</th>
          </tr>
        </thead>
        <tbody>
          ${timelineRows}
        </tbody>
      </table>
    </section>

    <section>
      <h2>File effects</h2>
      <table>
        <thead>
          <tr>
            <th>Effect</th>
            <th>Path</th>
          </tr>
        </thead>
        <tbody>
          ${fileEffectRows}
        </tbody>
      </table>
    </section>

    <section>
      <h2>Evidence paths</h2>
      <div class="paths">
        <div class="path">
          Session:
          ${escapeHtml(
            summary.session_dir
          )}
        </div>
        <div class="path">
          Bundle:
          ${escapeHtml(
            summary.replay_bundle_path
          )}
        </div>
      </div>
    </section>

    <footer>
      INVOCORDER records machine-action
      boundary facts and bundle integrity.
      This report does not decide truth,
      safety, authorization, admissibility,
      or external reality.
    </footer>
  </main>
</body>
</html>
`;

  writeFileSync(
    resolvedOutput,
    html
  );

  summary.report_path =
    resolvedOutput;

  return {
    output_path: resolvedOutput,
    summary
  };
}

export function formatSessionSummary(
  summary: SessionSummary
): string {
  const status =
    summary.status
    === "INVOCORDER_SESSION_VERIFIED"
      ? "RECORDED + VERIFIED"
      : summary.status
        === "INVOCORDER_SESSION_RECORDED_FAILURE"
        ? "FAILURE RECORDED + VERIFIED"
        : "INTEGRITY INVALID";

  const lines = [
    "",
    "INVOCORDER",
    status,
    "",
    `Command:      ${summary.command}`,
    `Integrity:    ${
      summary.integrity_valid
        ? "VALID"
        : "INVALID"
    }`,
    `Exit:         ${
      summary.exit_code ?? "n/a"
    }`,
    `Records:      ${
      summary.record_count
    }`,
    `Omissions:    ${
      summary.omission_count
    }`,
    `File effects: ${
      summary.file_effect_count
    }`,
    `Session:      ${
      summary.session_dir
    }`,
    `Bundle:       ${
      summary.replay_bundle_path
    }`
  ];

  if (summary.report_path) {
    lines.push(
      `Report:       ${
        summary.report_path
      }`
    );
  }

  return lines.join("\n");
}

export function inspectDoctor(): DoctorResult {
  const checks: DoctorCheck[] = [];

  const nodeMajor = Number.parseInt(
    process.versions.node.split(".")[0],
    10
  );

  checks.push({
    name: "node-runtime",
    ok:
      Number.isInteger(nodeMajor)
      && nodeMajor >= 18,
    detail:
      `Node ${process.versions.node}`
  });

  const version =
    readRecorderVersion();

  checks.push({
    name: "package-version",
    ok:
      version.length > 0
      && version !== "unknown",
    detail: version
  });

  checks.push({
    name: "executable",
    ok: existsSync(
      process.execPath
    ),
    detail: process.execPath
  });

  try {
    accessSync(
      process.cwd(),
      constants.W_OK
    );

    checks.push({
      name: "working-directory",
      ok: true,
      detail: process.cwd()
    });
  } catch {
    checks.push({
      name: "working-directory",
      ok: false,
      detail:
        `Not writable: ${
          process.cwd()
        }`
    });
  }

  const ready = checks.every(
    (check) => check.ok
  );

  return {
    schema:
      "invocorder.product.doctor.v1",
    status:
      ready
        ? "INVOCORDER_READY"
        : "INVOCORDER_NEEDS_ATTENTION",
    version,
    node_version:
      process.versions.node,
    working_directory:
      process.cwd(),
    checks,
    recommended_command:
      "invocorder capture -- npm test"
  };
}

export function formatDoctor(
  result: DoctorResult
): string {
  return [
    "",
    "INVOCORDER DOCTOR",
    result.status === "INVOCORDER_READY"
      ? "READY"
      : "NEEDS ATTENTION",
    "",
    ...result.checks.map(
      (check) =>
        `${
          check.ok ? "⃼��" : "⃼��"
        } ${check.name}: ${check.detail}`
    ),
    "",
    `Start: ${
      result.recommended_command
    }`
  ].join("\n");
}

export function productExplanation(): JsonObject {
  return {
    schema:
      "invocorder.product.explanation.v1",
    status:
      "INVOCORDER_PRODUCT_EXPLAINED",
    tagline:
      "Record any command. Get a tamper-evident "
      + "replay bundle and a readable local report.",
    primary_command:
      "invocorder capture -- <command> [args...]",
    zero_account: true,
    zero_cloud_requirement: true,
    zero_code_change: true,
    records: [
      "command and arguments after redaction",
      "bounded stdout and stderr",
      "exit code and signal",
      "file creations, modifications, and deletions",
      "hashed environment facts",
      "redactions and omissions",
      "hash-chained boundary records"
    ],
    outputs: [
      "session.json",
      "records.jsonl",
      "omissions.jsonl",
      "replay-bundle.json",
      "bundle-integrity-result.json",
      "invocorder-report.html"
    ],
    non_claims: {
      proves_truth: false,
      proves_safety: false,
      proves_authorization: false,
      proves_admissibility: false,
      proves_external_reality: false
    }
  };
}
