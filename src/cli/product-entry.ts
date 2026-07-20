#!/usr/bin/env node

import {
  mkdirSync,
  writeFileSync
} from "node:fs";
import {
  dirname,
  join,
  resolve
} from "node:path";

import {
  verifyBundleFile
} from "../bundle/verify-bundle-file.js";
import {
  recordBoundaryJsonlFile
} from "../capture/record-boundary-jsonl-file.js";
import {
  formatDoctor,
  formatSessionSummary,
  inspectDoctor,
  productExplanation,
  renderSessionReport,
  resolveSessionDirectory,
  summarizeSession
} from "../product/session-experience.js";
import {
  runCommand
} from "../process/run-command.js";
import {
  readRecorderVersion
} from "../version.js";

const args =
  process.argv.slice(2);

function printJson(
  value: unknown
): void {
  console.log(
    JSON.stringify(
      value,
      null,
      2
    )
  );
}

function hasFlag(
  flag: string
): boolean {
  return args.includes(flag);
}

function valueAfterFlag(
  flag: string,
  start = 0,
  end = args.length
): string | undefined {
  for (
    let index = start;
    index < end;
    index += 1
  ) {
    if (args[index] === flag) {
      return args[index + 1];
    }
  }

  return undefined;
}

function firstReference(
  start = 1
): string {
  for (
    let index = start;
    index < args.length;
    index += 1
  ) {
    const value = args[index];

    if (value === "--out") {
      index += 1;
      continue;
    }

    if (value.startsWith("--")) {
      continue;
    }

    return value;
  }

  return "latest";
}

function printUsage(): void {
  console.log(`
INVOCORDER

Record any command. Get a tamper-evident replay bundle
and a readable local report.

Three-second start:
  invocorder quickstart
  invocorder capture -- npm test

Human product commands:
  invocorder explain [--json]
  invocorder doctor [--json]
  invocorder quickstart [--json]
  invocorder capture [--out report.html] -- <command> [args...]
  invocorder show [latest|session|bundle] [--json]
  invocorder report [latest|session|bundle] [--out report.html] [--json]
  invocorder verify [latest|session|bundle] [--json]

Advanced commands remain available:
  invocorder run -- <command> [args...]
  invocorder mcp-stdio-file <jsonl-file>
  invocorder record-jsonl <kind> <jsonl-file> [name]
  invocorder verify-bundle <replay-bundle.json>
  invocorder generate-signing-key <private-key.pem>
  invocorder sign-bundle <replay-bundle.json> [--key <private-key.pem>]
  invocorder verify-signed-bundle <signed-bundle-envelope.json>
  invocorder power-map [--all]
  invocorder power-plane
  invocorder local-topology [--workspace-root <path>]
  invocorder workspace-perimeter [--workspace-root <path>] [--require-local]

Aliases:
  start   = quickstart
  record  = capture
  inspect = show
  view    = report
  check   = verify
`.trim());
}

async function runQuickstart(): Promise<void> {
  const inputPath = resolve(
    ".invocorder",
    "quickstart",
    "boundary.jsonl"
  );

  mkdirSync(
    dirname(inputPath),
    {
      recursive: true
    }
  );

  const frames = [
    {
      direction: "request",
      action:
        "record-first-boundary",
      source:
        "invocorder-quickstart"
    },
    {
      direction: "response",
      result:
        "boundary-recorded"
    },
    {
      direction: "effect",
      output:
        "tamper-evident replay bundle"
    }
  ];

  writeFileSync(
    inputPath,
    frames
      .map((frame) =>
        JSON.stringify(frame)
      )
      .join("\n")
      + "\n"
  );

  const result =
    await recordBoundaryJsonlFile(
      inputPath,
      "api",
      "quickstart"
    );

  const report =
    renderSessionReport(
      result.session_dir
    );

  if (hasFlag("--json")) {
    printJson({
      schema:
        "invocorder.product.quickstart.v1",
      status:
        "INVOCORDER_QUICKSTART_COMPLETE",
      ...result,
      report_path:
        report.output_path,
      summary:
        report.summary,
      next_command:
        "invocorder capture -- npm test"
    });

    return;
  }

  console.log(
    formatSessionSummary(
      report.summary
    )
  );

  console.log("");
  console.log(
    "Next: invocorder capture -- npm test"
  );
}

async function main(): Promise<void> {
  const command = args[0];

  if (
    args.length === 0
    || command === "help"
    || command === "--help"
    || command === "-h"
  ) {
    printUsage();
    return;
  }

  if (
    command === "version"
    || command === "--version"
    || command === "-v"
  ) {
    console.log(
      readRecorderVersion()
    );
    return;
  }

  if (command === "explain") {
    const explanation =
      productExplanation();

    if (hasFlag("--json")) {
      printJson(explanation);
      return;
    }

    console.log("");
    console.log("INVOCORDER");
    console.log(
      String(
        explanation.tagline
      )
    );
    console.log("");
    console.log(
      `Start: ${
        String(
          explanation.primary_command
        )
      }`
    );
    console.log("");
    console.log(
      "No account. No cloud requirement. "
      + "No source-code changes."
    );

    return;
  }

  if (command === "doctor") {
    const doctor =
      inspectDoctor();

    if (hasFlag("--json")) {
      printJson(doctor);
    } else {
      console.log(
        formatDoctor(doctor)
      );
    }

    process.exitCode =
      doctor.status
      === "INVOCORDER_READY"
        ? 0
        : 1;

    return;
  }

  if (
    command === "quickstart"
    || command === "start"
  ) {
    await runQuickstart();
    return;
  }

  if (
    command === "capture"
    || command === "record"
  ) {
    const separatorIndex =
      args.indexOf("--");

    if (
      separatorIndex < 0
      || !args[separatorIndex + 1]
    ) {
      throw new Error(
        "usage: invocorder capture "
        + "[--out report.html] -- "
        + "<command> [args...]"
      );
    }

    const executable =
      args[separatorIndex + 1];

    const executableArgs =
      args.slice(
        separatorIndex + 2
      );

    const reportOutput =
      valueAfterFlag(
        "--out",
        1,
        separatorIndex
      );

    await runCommand(
      executable,
      executableArgs
    );

    const report =
      renderSessionReport(
        "latest",
        reportOutput
      );

    if (hasFlag("--json")) {
      printJson({
        schema:
          "invocorder.product.capture.v1",
        status:
          report.summary.status,
        output_path:
          report.output_path,
        summary:
          report.summary
      });
    } else {
      console.log(
        formatSessionSummary(
          report.summary
        )
      );
    }

    return;
  }

  if (
    command === "show"
    || command === "inspect"
  ) {
    const summary =
      summarizeSession(
        firstReference()
      );

    if (hasFlag("--json")) {
      printJson(summary);
    } else {
      console.log(
        formatSessionSummary(
          summary
        )
      );
    }

    return;
  }

  if (
    command === "report"
    || command === "view"
  ) {
    const report =
      renderSessionReport(
        firstReference(),
        valueAfterFlag("--out")
      );

    if (hasFlag("--json")) {
      printJson({
        schema:
          "invocorder.product.report.v1",
        status:
          "INVOCORDER_REPORT_READY",
        output_path:
          report.output_path,
        summary:
          report.summary
      });
    } else {
      console.log(
        formatSessionSummary(
          report.summary
        )
      );
    }

    return;
  }

  if (
    command === "verify"
    || command === "check"
  ) {
    const sessionDir =
      resolveSessionDirectory(
        firstReference()
      );

    const bundlePath = join(
      sessionDir,
      "replay-bundle.json"
    );

    const verification =
      verifyBundleFile(
        bundlePath
      );

    if (hasFlag("--json")) {
      printJson({
        schema:
          "invocorder.product.verification.v1",
        status:
          verification.valid
            ? "INVOCORDER_VERIFIED"
            : "INVOCORDER_INVALID",
        bundle_path:
          bundlePath,
        ...verification
      });
    } else {
      console.log("");
      console.log(
        "INVOCORDER VERIFY"
      );
      console.log(
        verification.valid
          ? "VALID"
          : "INVALID"
      );
      console.log("");
      console.log(
        `Bundle: ${bundlePath}`
      );

      for (
        const error
        of verification.errors
      ) {
        console.log(`- ${error}`);
      }
    }

    process.exitCode =
      verification.valid
        ? 0
        : 1;

    return;
  }

  await import(
    "./invocorder.js"
  );
}

main().catch(
  (error: unknown) => {
    console.error(
      error instanceof Error
        ? error.message
        : String(error)
    );

    process.exit(1);
  }
);
