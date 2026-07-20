import assert from "node:assert/strict";
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
import test from "node:test";

function runCli(
  cwd: string,
  args: string[]
): string {
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

  assert.equal(
    result.status,
    0,
    result.stdout + result.stderr
  );

  return result.stdout;
}

test(
  "three-second quickstart produces a readable report",
  () => {
    const root = mkdtempSync(
      join(
        tmpdir(),
        "invocorder-product-"
      )
    );

    const quickstart = JSON.parse(
      runCli(
        root,
        [
          "quickstart",
          "--json"
        ]
      )
    );

    assert.equal(
      quickstart.status,
      "INVOCORDER_QUICKSTART_COMPLETE"
    );

    assert.equal(
      quickstart.summary
        .integrity_valid,
      true
    );

    assert.equal(
      existsSync(
        quickstart.report_path
      ),
      true
    );

    const html = readFileSync(
      quickstart.report_path,
      "utf8"
    );

    assert.match(
      html,
      /INVOCORDER Evidence Report/
    );

    const show = JSON.parse(
      runCli(
        root,
        [
          "show",
          "latest",
          "--json"
        ]
      )
    );

    assert.equal(
      show.integrity_valid,
      true
    );

    const verify = JSON.parse(
      runCli(
        root,
        [
          "verify",
          "latest",
          "--json"
        ]
      )
    );

    assert.equal(
      verify.valid,
      true
    );
  }
);

test(
  "doctor exposes a machine-readable readiness result",
  () => {
    const root = mkdtempSync(
      join(
        tmpdir(),
        "invocorder-doctor-"
      )
    );

    const doctor = JSON.parse(
      runCli(
        root,
        [
          "doctor",
          "--json"
        ]
      )
    );

    assert.equal(
      doctor.status,
      "INVOCORDER_READY"
    );

    assert.equal(
      doctor.checks.every(
        (
          entry: {
            ok: boolean;
          }
        ) => entry.ok
      ),
      true
    );
  }
);
