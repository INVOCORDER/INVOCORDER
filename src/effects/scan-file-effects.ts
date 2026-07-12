import { createHash } from "node:crypto";
import {
  lstatSync,
  readdirSync,
  readFileSync
} from "node:fs";
import {
  join,
  relative,
  resolve,
  sep
} from "node:path";

export interface FileSnapshot {
  path: string;
  size_bytes: number;
  mtime_ms: number;
  sha256: string | null;
  hash_omitted_reason: string | null;
}

export interface FileSnapshotResult {
  root: string;
  files: FileSnapshot[];
  omissions: string[];
}

export interface FileEffect {
  effect: "created" | "modified" | "deleted";
  path: string;
  before: FileSnapshot | null;
  after: FileSnapshot | null;
}

export interface FileScanOptions {
  max_files?: number;
  max_hash_bytes?: number;
  ignored_directories?: string[];
}

const DEFAULT_IGNORED_DIRECTORIES = [
  ".git",
  ".invocorder",
  "node_modules",
  "dist"
];

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

function hashFile(path: string): string {
  return createHash("sha256")
    .update(readFileSync(path))
    .digest("hex");
}

export function snapshotFiles(
  root = process.cwd(),
  options: FileScanOptions = {}
): FileSnapshotResult {
  const absoluteRoot = resolve(root);

  const ignored = new Set(
    options.ignored_directories ??
      DEFAULT_IGNORED_DIRECTORIES
  );

  const maxFiles = options.max_files ?? 10000;
  const maxHashBytes =
    options.max_hash_bytes ?? 10 * 1024 * 1024;

  const files: FileSnapshot[] = [];
  const omissions: string[] = [];

  function walk(directory: string): void {
    if (files.length >= maxFiles) {
      omissions.push(
        `file scan stopped at max_files=${maxFiles}`
      );
      return;
    }

    let entries;

    try {
      entries = readdirSync(directory, {
        withFileTypes: true
      });
    } catch (error) {
      omissions.push(
        `file scan failed for ${directory}: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
      return;
    }

    entries.sort((left, right) =>
      left.name.localeCompare(right.name)
    );

    for (const entry of entries) {
      if (files.length >= maxFiles) {
        return;
      }

      if (ignored.has(entry.name)) {
        continue;
      }

      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      let stat;

      try {
        stat = lstatSync(absolutePath);
      } catch (error) {
        omissions.push(
          `file stat failed for ${absolutePath}: ${
            error instanceof Error
              ? error.message
              : String(error)
          }`
        );
        continue;
      }

      if (!stat.isFile()) {
        omissions.push(
          `non-regular path omitted: ${normalizePath(
            relative(absoluteRoot, absolutePath)
          )}`
        );
        continue;
      }

      let digest: string | null = null;
      let hashOmittedReason: string | null = null;

      if (stat.size > maxHashBytes) {
        hashOmittedReason =
          `size exceeds max_hash_bytes=${maxHashBytes}`;
      } else {
        try {
          digest = hashFile(absolutePath);
        } catch (error) {
          hashOmittedReason =
            error instanceof Error
              ? error.message
              : String(error);
        }
      }

      files.push({
        path: normalizePath(
          relative(absoluteRoot, absolutePath)
        ),
        size_bytes: stat.size,
        mtime_ms: stat.mtimeMs,
        sha256: digest,
        hash_omitted_reason: hashOmittedReason
      });
    }
  }

  walk(absoluteRoot);

  files.sort((left, right) =>
    left.path.localeCompare(right.path)
  );

  return {
    root: absoluteRoot,
    files,
    omissions
  };
}

export function diffFileSnapshots(
  before: FileSnapshotResult,
  after: FileSnapshotResult
): FileEffect[] {
  const beforeByPath = new Map(
    before.files.map((file) => [file.path, file])
  );

  const afterByPath = new Map(
    after.files.map((file) => [file.path, file])
  );

  const paths = new Set([
    ...beforeByPath.keys(),
    ...afterByPath.keys()
  ]);

  const effects: FileEffect[] = [];

  for (const path of [...paths].sort()) {
    const beforeFile = beforeByPath.get(path) ?? null;
    const afterFile = afterByPath.get(path) ?? null;

    if (!beforeFile && afterFile) {
      effects.push({
        effect: "created",
        path,
        before: null,
        after: afterFile
      });
      continue;
    }

    if (beforeFile && !afterFile) {
      effects.push({
        effect: "deleted",
        path,
        before: beforeFile,
        after: null
      });
      continue;
    }

    if (
      beforeFile &&
      afterFile &&
      (
        beforeFile.size_bytes !== afterFile.size_bytes ||
        beforeFile.sha256 !== afterFile.sha256 ||
        (
          beforeFile.sha256 === null &&
          afterFile.sha256 === null &&
          beforeFile.mtime_ms !== afterFile.mtime_ms
        )
      )
    ) {
      effects.push({
        effect: "modified",
        path,
        before: beforeFile,
        after: afterFile
      });
    }
  }

  return effects;
}
