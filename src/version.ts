import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function readRecorderVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "../../VERSION"),
    join(here, "../VERSION"),
    "VERSION"
  ];

  for (const path of candidates) {
    try {
      return readFileSync(path, "utf8").trim();
    } catch {
      // keep trying
    }
  }

  return "unknown";
}
