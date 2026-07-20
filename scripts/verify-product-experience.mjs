#!/usr/bin/env node

import {
  existsSync,
  mkdtempSync,
  readFileSync
} from "node:fs";
import {
  tmpdir
} from "node:os";
import {
  join,
  resolve
} from "node:path";
import {
  spawnSync
} from "node:child_process";

const failures = [];

function fail(message) {
  failures.push(message);
}

function run(cwd, args) {
  const cli = resolve(
    process.cwd(),
    "bin/invocorder.js"
  );

  const result = spawnSync(
    process.execPath,
    [
      cli,
      ...args
    ],
    {
      cwd,
      encoding: "utf8",
      env: process.env
    }
  );

  if (result.status !== 0) {
    fail(
      `${args.join(" ")} failed: `
      + result.stdout
      + result.stderr
    );
  }

  return result.stdout;
}

const packageJson = JSON.parse(
  readFileSync(
    "package.json",
    "utf8"
  )
);

const contract = JSON.parse(
  readFileSync(
    "PRODUCT/INVOCORDER_PRODUCT_CONTRACT.json",
    "utf8"
  )
);

if (
  packageJson.version !== "2.1.0"
) {
  fail(
    `unexpected package version: ${
      packageJson.version
    }`
  );
}

for (const path of [
  "PRODUCT/INVOCORDER_PRODUCT_CONTRACT.json",
  "docs/QUICKSTART.md",
  "docs/PRODUCT.md",
  "docs/REPORTS.md",
  "src/product/session-experience.ts",
  "src/cli/product-entry.ts",
  "tests/product-experience.test.ts"
]) {
  if (!existsSync(path)) {
    fail(
      `missing product path: ${path}`
    );
  }
}

if (
  contract.primary_command
  !== "invocorder capture -- <command> [args...]"
) {
  fail(
    "product contract primary command mismatch"
  );
}

const root = mkdtempSync(
  join(
    tmpdir(),
    "invocorder-product-verify-"
  )
);

const help = run(
  root,
  [
    "--help"
  ]
);

if (
  !help.includes(
    "Record any command. "
    + "Get a tamper-evident replay bundle"
  )
) {
  fail(
    "help does not expose the "
    + "three-second product sentence"
  );
}

const explanation = JSON.parse(
  run(
    root,
    [
      "explain",
      "--json"
    ]
  )
);

if (
  explanation.status
  !== "INVOCORDER_PRODUCT_EXPLAINED"
) {
  fail(
    "product explanation status mismatch"
  );
}

const doctor = JSON.parse(
  run(
    root,
    [
      "doctor",
      "--json"
    ]
  )
);

if (
  doctor.status
  !== "INVOCORDER_READY"
) {
  fail(
    "doctor did not report ready"
  );
}

const quickstart = JSON.parse(
  run(
    root,
    [
      "quickstart",
      "--json"
    ]
  )
);

if (
  quickstart.status
  !== "INVOCORDER_QUICKSTART_COMPLETE"
) {
  fail(
    "quickstart status mismatch"
  );
}

if (
  !existsSync(
    quickstart.report_path
  )
) {
  fail(
    "quickstart report missing"
  );
}

const show = JSON.parse(
  run(
    root,
    [
      "show",
      "latest",
      "--json"
    ]
  )
);

if (
  show.integrity_valid !== true
) {
  fail(
    "latest session is not integrity-valid"
  );
}

const verify = JSON.parse(
  run(
    root,
    [
      "verify",
      "latest",
      "--json"
    ]
  )
);

if (
  verify.valid !== true
) {
  fail(
    "latest bundle verification failed"
  );
}

const result = {
  object_type:
    "INVOCORDER_PRODUCT_EXPERIENCE_VERIFICATION_RESULT",
  schema_version: "2.1.0",
  status:
    failures.length === 0
      ? "INVOCORDER_PRODUCT_EXPERIENCE_VERIFIED"
      : "INVOCORDER_PRODUCT_EXPERIENCE_FAILED",
  package_version:
    packageJson.version,
  primary_command:
    contract.primary_command,
  quickstart_report:
    quickstart.report_path,
  failures_count:
    failures.length,
  failures,
  non_claims: {
    proves_truth: false,
    proves_safety: false,
    proves_authorization: false,
    proves_admissibility: false,
    proves_external_reality: false
  }
};

console.log(
  JSON.stringify(
    result,
    null,
    2
  )
);

if (failures.length > 0) {
  process.exit(1);
}

console.log(
  "INVOCORDER_PRODUCT_EXPERIENCE_VERIFY_PASS=true"
);
