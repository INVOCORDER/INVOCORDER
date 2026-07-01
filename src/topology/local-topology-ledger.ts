import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export interface LocalTopologyLedgerRequiredFile {
  file: string;
  exists: boolean;
  sha256: string | null;
}

export interface LocalTopologyLedgerSurface {
  id: string;
  path: string;
  role: string;
  required: boolean;
  exists: boolean;
  required_files: LocalTopologyLedgerRequiredFile[];
  missing_required_files: string[];
  inspected_file_count: number;
  topology_hash: string;
}

export interface LocalTopologyLedgerInspection {
  schema: "invocorder.local_topology_ledger.inspection.v1";
  status: "LOCAL_TOPOLOGY_LEDGER_VERIFIED" | "LOCAL_TOPOLOGY_LEDGER_FAILED";
  workspace_root: string;
  inspected_surface_count: number;
  inspected_surfaces: LocalTopologyLedgerSurface[];
  non_claims: {
    topology_presence_is_truth: false;
    sibling_presence_expands_invocorder_role: false;
    generated_media_is_source_authority: false;
    node_modules_is_source_authority: false;
    dist_is_source_authority: false;
    topology_ledger_is_system_completion: false;
  };
  failures: string[];
}

const DECLARED_SURFACES = [
  {
    id: "CAPTURE_CONTRACT",
    path: "CAPTURE-CONTRACT",
    required: true,
    role: "capture contract boundary",
    required_files: [
      "README.md",
      "VERSION",
      "LICENSE",
      "CAPTURE_CONTRACT.md",
      "BOUNDARY_FACTS.md",
      "REPLAY_BUNDLE_REQUIREMENTS.md"
    ]
  },
  {
    id: "CINEMATICUM",
    path: "CINEMATICUM",
    required: true,
    role: "adjacent admissible motion picture jurisdiction surface",
    required_files: [
      "README.md",
      "LICENSE",
      "package.json",
      "PRODUCT/INSTALLABLE_PRODUCT_BOUNDARY.json",
      "CASES/CASE_001_THE_LAST_RENDER/DIRECTION/DIRECTOR_ENGINE_MANIFEST.json"
    ]
  },
  {
    id: "EVIDENCE_SCHEMAS",
    path: "EVIDENCE-SCHEMAS",
    required: true,
    role: "machine action evidence schema surface",
    required_files: [
      "README.md",
      "VERSION",
      "LICENSE",
      "schemas/machine-action-record.schema.json",
      "schemas/replay-bundle.schema.json",
      "schemas/action-session.schema.json"
    ]
  },
  {
    id: "HOSTILE_FIXTURES",
    path: "HOSTILE-FIXTURES",
    required: true,
    role: "hostile fixture replay surface",
    required_files: [
      "README.md",
      "VERSION",
      "LICENSE",
      "fixtures/mcp/INDEX.json",
      "fixtures/signed-bundles/INDEX.json"
    ]
  },
  {
    id: "INTEGRATIONS",
    path: "INTEGRATIONS",
    required: true,
    role: "integration boundary documentation surface",
    required_files: [
      "README.md",
      "VERSION",
      "LICENSE",
      "mcp-stdio/README.md",
      "local-command/README.md",
      "verifrax-ingestion/README.md"
    ]
  },
  {
    id: "INVOCORDER",
    path: "INVOCORDER",
    required: true,
    role: "native machine action evidence substrate",
    required_files: [
      "README.md",
      "VERSION",
      "LICENSE",
      "package.json",
      "POWER_PLANE/INVOCORDER_NPM_POWER_PLANE_STANDARD.json",
      "WORKSPACE_PERIMETER/INVOCORDER_LOCAL_WORKSPACE_PERIMETER_STANDARD.json"
    ]
  }
] as const;

function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function shouldIgnore(relPath: string): boolean {
  const parts = relPath.split("/");
  return (
    parts.includes(".git") ||
    parts.includes("node_modules") ||
    parts.includes("dist") ||
    parts.includes(".invocorder") ||
    parts.includes(".DS_Store") ||
    relPath.endsWith(".tgz") ||
    relPath.endsWith(".tar.gz") ||
    relPath.endsWith(".mp4")
  );
}

function walkFiles(root: string, base = root): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolutePath = join(root, entry.name);
    const relPath = relative(base, absolutePath).replaceAll("\\", "/");
    if (shouldIgnore(relPath)) continue;
    if (entry.isDirectory()) {
      out.push(...walkFiles(absolutePath, base));
    } else if (entry.isFile()) {
      out.push(relPath);
    }
  }
  return out;
}

function inspectSurface(workspaceRoot: string, surface: (typeof DECLARED_SURFACES)[number]): LocalTopologyLedgerSurface {
  const absolutePath = join(workspaceRoot, surface.path);
  const exists = existsSync(absolutePath);
  const required_files = surface.required_files.map((file) => {
    const path = join(absolutePath, file);
    const fileExists = existsSync(path);
    return {
      file,
      exists: fileExists,
      sha256: fileExists && statSync(path).isFile() ? sha256File(path) : null
    };
  });
  const files = exists ? walkFiles(absolutePath) : [];
  const fileHashLines = files.map((file) => `${file}\t${sha256File(join(absolutePath, file))}`);
  return {
    id: surface.id,
    path: surface.path,
    role: surface.role,
    required: surface.required,
    exists,
    required_files,
    missing_required_files: required_files.filter((item) => !item.exists).map((item) => item.file),
    inspected_file_count: files.length,
    topology_hash: sha256Text(fileHashLines.join("\n"))
  };
}

export function inspectLocalTopologyLedger(workspaceRoot = join(process.cwd(), "..")): LocalTopologyLedgerInspection {
  const inspected = DECLARED_SURFACES.map((surface) => inspectSurface(workspaceRoot, surface));
  const failures: string[] = [];

  for (const surface of inspected) {
    if (surface.required && !surface.exists) failures.push(`required surface missing: ${surface.path}`);
    for (const missing of surface.missing_required_files) failures.push(`required file missing: ${surface.path}/${missing}`);
  }

  return {
    schema: "invocorder.local_topology_ledger.inspection.v1",
    status: failures.length === 0 ? "LOCAL_TOPOLOGY_LEDGER_VERIFIED" : "LOCAL_TOPOLOGY_LEDGER_FAILED",
    workspace_root: workspaceRoot,
    inspected_surface_count: inspected.length,
    inspected_surfaces: inspected,
    non_claims: {
      topology_presence_is_truth: false,
      sibling_presence_expands_invocorder_role: false,
      generated_media_is_source_authority: false,
      node_modules_is_source_authority: false,
      dist_is_source_authority: false,
      topology_ledger_is_system_completion: false
    },
    failures
  };
}
