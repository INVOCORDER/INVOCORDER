import { existsSync } from "node:fs";
import { resolve } from "node:path";

export type LocalWorkspaceSurface = {
  id: string;
  path: string;
  role: string;
  native: boolean;
  required: boolean;
  required_files: string[];
};

export type LocalWorkspacePerimeterOptions = {
  workspaceRoot?: string;
  requireSiblings?: boolean;
};

export const LOCAL_WORKSPACE_SURFACES: readonly LocalWorkspaceSurface[] = [
  {
    id: "INVOCORDER",
    path: "INVOCORDER",
    role: "machine_action_evidence_substrate",
    native: true,
    required: true,
    required_files: [
      "README.md",
      "VERSION",
      "LICENSE",
      "package.json",
      "POWER_PLANE/INVOCORDER_NPM_POWER_PLANE_STANDARD.json"
    ]
  },
  {
    id: "CAPTURE_CONTRACT",
    path: "CAPTURE-CONTRACT",
    role: "capture_contract_boundary",
    native: false,
    required: true,
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
    id: "EVIDENCE_SCHEMAS",
    path: "EVIDENCE-SCHEMAS",
    role: "machine_action_evidence_schema_surface",
    native: false,
    required: true,
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
    role: "hostile_fixture_replay_surface",
    native: false,
    required: true,
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
    role: "integration_boundary_documentation_surface",
    native: false,
    required: true,
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
    id: "CINEMATICUM",
    path: "CINEMATICUM",
    role: "adjacent_admissible_motion_picture_jurisdiction_surface",
    native: false,
    required: true,
    required_files: [
      "README.md",
      "LICENSE",
      "package.json",
      "PRODUCT/INSTALLABLE_PRODUCT_BOUNDARY.json",
      "CASES/CASE_001_THE_LAST_RENDER/DIRECTION/DIRECTOR_ENGINE_MANIFEST.json"
    ]
  }
] as const;

export function inspectLocalWorkspacePerimeter(options: LocalWorkspacePerimeterOptions = {}) {
  const workspaceRoot = resolve(options.workspaceRoot ?? resolve(process.cwd(), ".."));
  const requireSiblings = options.requireSiblings === true;

  const inspectedSurfaces = LOCAL_WORKSPACE_SURFACES.map((surface) => {
    const absolutePath = resolve(workspaceRoot, surface.path);
    const exists = existsSync(absolutePath);
    const requiredFiles = surface.required_files.map((file) => {
      const filePath = resolve(absolutePath, file);
      return {
        file,
        exists: existsSync(filePath)
      };
    });
    return {
      ...surface,
      absolute_path: absolutePath,
      exists,
      required_files: requiredFiles,
      missing_required_files: requiredFiles.filter((entry) => !entry.exists).map((entry) => entry.file)
    };
  });

  const failures = inspectedSurfaces.flatMap((surface) => {
    if (!requireSiblings) return [];
    if (!surface.required) return [];
    const failureMessages: string[] = [];
    if (!surface.exists) {
      failureMessages.push(`${surface.id}: missing surface directory ${surface.path}`);
    }
    for (const missingFile of surface.missing_required_files) {
      failureMessages.push(`${surface.id}: missing required file ${missingFile}`);
    }
    return failureMessages;
  });

  return {
    schema: "invocorder.local_workspace_perimeter_inspection.v1",
    status: failures.length === 0
      ? requireSiblings
        ? "LOCAL_WORKSPACE_PERIMETER_VERIFIED"
        : "LOCAL_WORKSPACE_PERIMETER_BOUND"
      : "LOCAL_WORKSPACE_PERIMETER_FAIL",
    workspace_root: workspaceRoot,
    require_siblings: requireSiblings,
    inspected_surface_count: inspectedSurfaces.length,
    inspected_surfaces: inspectedSurfaces,
    non_claims: {
      local_workspace_presence_is_truth: false,
      sibling_presence_expands_invocorder_role: false,
      node_modules_presence_is_source_authority: false,
      package_installation_is_verification_result: false,
      workspace_perimeter_is_system_completion: false
    },
    failures
  };
}
