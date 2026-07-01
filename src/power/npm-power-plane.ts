import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";

export interface InvocorderNpmPowerPackageRecord {
  name: string;
  role_class: string;
  dependency: boolean;
  native: boolean;
  source_role: string;
  power_role: string;
  claim_boundary: string;
  [key: string]: unknown;
}

export type InvocorderNpmPowerPackageStatus = InvocorderNpmPowerPackageRecord & {
  installed: boolean;
  resolution: string | null;
};

export interface InvocorderNpmPowerPlaneReport {
  schema: "invocorder.npm_power_plane.status.v1";
  package_name: "@invocorder/recorder";
  total_bound_packages: number;
  native_packages: number;
  external_runtime_dependencies: number;
  installed_external_dependencies: number;
  missing_external_dependencies: string[];
  packages: InvocorderNpmPowerPackageStatus[];
  non_claims: {
    package_installation_decides_truth: false;
    package_installation_issues_authority: false;
    package_installation_verifies_final_truth: false;
    package_installation_recognizes_terminal_truth: false;
    package_installation_assigns_recourse: false;
    package_installation_proves_external_reality: false;
  };
}

export type InvocorderNpmPowerPlaneStatus = InvocorderNpmPowerPlaneReport;

export const INVOCORDER_NPM_POWER_PACKAGE_RECORDS = [
  {
    "name": "@invocorder/recorder",
    "role_class": "NATIVE_MACHINE_ACTION_RECORDER",
    "dependency": false,
    "native": true,
    "source_role": "INVOCORDER native recorder package",
    "power_role": "hash-chained machine-action recording, replay bundle compilation, signed-bundle support",
    "claim_boundary": "native package identity; not installed as recursive self-dependency"
  },
  {
    "name": "@verifrax/verifrax",
    "role_class": "CORE_PROTOCOL_PACKAGE",
    "dependency": true,
    "native": false,
    "source_role": "VERIFRAX authored protocol and evidence boundary",
    "power_role": "protocol-adjacent verification and evidence-bound mechanics",
    "claim_boundary": "not law, not accepted state, not terminal recognition, not recourse"
  },
  {
    "name": "@verifrax/verifrax-verify",
    "role_class": "PUBLIC_VERIFIER_PACKAGE",
    "dependency": true,
    "native": false,
    "source_role": "public verifier package surface",
    "power_role": "verification interface and replay helper boundary",
    "claim_boundary": "verifies where admitted; does not publish proof or recognize truth"
  },
  {
    "name": "@verifrax/verifrax-spec",
    "role_class": "DERIVED_SPEC_PACKAGE",
    "dependency": true,
    "native": false,
    "source_role": "derived specification publication",
    "power_role": "formal specification and schema-consumable material",
    "claim_boundary": "derived spec; not upstream law or accepted state"
  },
  {
    "name": "@verifrax/verifrax-profiles",
    "role_class": "PROFILE_PACKAGE",
    "dependency": true,
    "native": false,
    "source_role": "deterministic profile constraints",
    "power_role": "profile interpretation constraints and compatibility checks",
    "claim_boundary": "constrains interpretation; does not rewrite law or specification"
  },
  {
    "name": "@verifrax/auctoriseal",
    "role_class": "AUTHORITY_PACKAGE",
    "dependency": true,
    "native": false,
    "source_role": "authority issuance package surface",
    "power_role": "authority object tooling and authorization-scope support",
    "claim_boundary": "authority support; not execution, verification, recognition, or recourse"
  },
  {
    "name": "@verifrax/corpiform",
    "role_class": "EXECUTION_PACKAGE",
    "dependency": true,
    "native": false,
    "source_role": "governed execution package surface",
    "power_role": "execution runtime tools and receipt-supporting mechanics",
    "claim_boundary": "records what ran; does not prove what verified"
  },
  {
    "name": "@verifrax/cicullis",
    "role_class": "ENFORCEMENT_PACKAGE",
    "dependency": true,
    "native": false,
    "source_role": "CI, merge, and enforcement substrate",
    "power_role": "merge-boundary enforcement and policy-gate support",
    "claim_boundary": "enforcement support; not constitutional truth"
  },
  {
    "name": "@verifrax/sigillarium",
    "role_class": "ARCHIVE_REFERENCE_PACKAGE",
    "dependency": true,
    "native": false,
    "source_role": "seal archive and reference package surface",
    "power_role": "seal reference, preservation metadata, archive/certification support",
    "claim_boundary": "archive/reference support; not current truth by preservation"
  },
  {
    "name": "@verifrax/archicustos",
    "role_class": "PRIMITIVE_PACKAGE",
    "dependency": true,
    "native": false,
    "source_role": "custody-preservation primitive",
    "power_role": "custody and archival integrity primitives",
    "claim_boundary": "primitive support; not full archive authority"
  },
  {
    "name": "@verifrax/attestorium",
    "role_class": "PRIMITIVE_PACKAGE",
    "dependency": true,
    "native": false,
    "source_role": "attestation primitive",
    "power_role": "witness, assertion, and attestation support structures",
    "claim_boundary": "attestation primitive; not verification result or recognition"
  },
  {
    "name": "@verifrax/guillotine",
    "role_class": "PRIMITIVE_PACKAGE",
    "dependency": true,
    "native": false,
    "source_role": "terminal cutoff primitive",
    "power_role": "termination and irreversible cutoff semantics",
    "claim_boundary": "cutoff primitive; not terminal recognition or recourse by itself"
  },
  {
    "name": "@verifrax/irrevocull",
    "role_class": "PRIMITIVE_PACKAGE",
    "dependency": true,
    "native": false,
    "source_role": "irreversible judgment primitive",
    "power_role": "irreversible cull, refusal, and finality-adjacent mechanics",
    "claim_boundary": "judgment primitive; not recognition-of-record"
  },
  {
    "name": "@verifrax/kairoclasp",
    "role_class": "PRIMITIVE_PACKAGE",
    "dependency": true,
    "native": false,
    "source_role": "temporal boundary primitive",
    "power_role": "time boundary, temporal clasping, and timestamp-adjacent support",
    "claim_boundary": "temporal primitive; not accepted epoch by itself"
  },
  {
    "name": "@verifrax/limenward",
    "role_class": "PRIMITIVE_PACKAGE",
    "dependency": true,
    "native": false,
    "source_role": "threshold and boundary primitive",
    "power_role": "threshold guard logic and admission/refusal mechanics",
    "claim_boundary": "boundary primitive; not accepted admission by itself"
  },
  {
    "name": "@verifrax/originseal",
    "role_class": "PRIMITIVE_PACKAGE",
    "dependency": true,
    "native": false,
    "source_role": "origin and provenance primitive",
    "power_role": "origin binding, provenance sealing, and source assertion support",
    "claim_boundary": "origin primitive; not complete authority or verification result"
  },
  {
    "name": "@verifrax/validexor",
    "role_class": "PRIMITIVE_PACKAGE",
    "dependency": true,
    "native": false,
    "source_role": "verification primitive",
    "power_role": "validation mechanics and low-level verification semantics",
    "claim_boundary": "verification primitive; not full verification chamber authority"
  },
  {
    "name": "@verifrax/verifrax-api",
    "role_class": "MACHINE_INTERFACE_IMPLEMENTATION_PACKAGE",
    "dependency": true,
    "native": false,
    "source_role": "API and machine-contract implementation boundary",
    "power_role": "API client helpers, machine-access contracts, endpoint support",
    "claim_boundary": "machine interface; not accepted state or protocol sovereignty"
  },
  {
    "name": "@verifrax/root",
    "role_class": "ROOT_IMPLEMENTATION_PACKAGE",
    "dependency": true,
    "native": false,
    "source_role": "root implementation package boundary",
    "power_role": "public-entry and host-boundary implementation support",
    "claim_boundary": "root implementation; not constitutional root or system completion"
  },
  {
    "name": "@kaaffilm/mk10-pro",
    "role_class": "EXTERNAL_CREATIVE_ISSUANCE_PACKAGE",
    "dependency": true,
    "native": false,
    "source_role": "KAAFFILM installable creative issuance support package",
    "power_role": "external cinematic/issuance-adjacent package surface available to INVOCORDER recording",
    "claim_boundary": "external package support; not INVOCORDER truth, authorization, safety, or admissibility"
  },
  {
    "name": "@antimatterium/antimatterium",
    "role_class": "EXTERNAL_MACHINE_ACTION_DOMAIN_PACKAGE",
    "dependency": true,
    "native": false,
    "source_role": "ANTIMATTERIUM bounded mission-run/action domain package",
    "power_role": "external machine-action domain package available to INVOCORDER recording profiles",
    "claim_boundary": "external action-domain package; not production readiness, starship readiness, or physical production instruction"
  }
] as const satisfies readonly InvocorderNpmPowerPackageRecord[];

export const INVOCORDER_NPM_POWER_PACKAGES = INVOCORDER_NPM_POWER_PACKAGE_RECORDS;

export function listNpmPowerPackages(): readonly InvocorderNpmPowerPackageRecord[] {
  return INVOCORDER_NPM_POWER_PACKAGE_RECORDS;
}

function ancestorDirectories(start: string): string[] {
  const directories: string[] = [];
  let current = start;

  while (true) {
    directories.push(current);
    const parent = dirname(current);

    if (parent === current || current === parse(current).root) {
      break;
    }

    current = parent;
  }

  return directories;
}

function packageJsonCandidates(name: string): string[] {
  const segments = name.split("/");
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const startingDirectories = [process.cwd(), moduleDir];
  const candidates: string[] = [];

  for (const start of startingDirectories) {
    for (const ancestor of ancestorDirectories(start)) {
      candidates.push(join(ancestor, "node_modules", ...segments, "package.json"));
    }
  }

  return [...new Set(candidates)];
}

function resolveNpmPowerPackageJsonPath(name: string): string | null {
  for (const candidate of packageJsonCandidates(name)) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function resolveNpmPowerPackageRoot(name: string): string | null {
  if (name === "@invocorder/recorder") {
    return "native:@invocorder/recorder";
  }

  const packageJsonPath = resolveNpmPowerPackageJsonPath(name);
  return packageJsonPath ? dirname(packageJsonPath) : null;
}

export function inspectNpmPowerPlane(): InvocorderNpmPowerPlaneReport {
  const packages: InvocorderNpmPowerPackageStatus[] = INVOCORDER_NPM_POWER_PACKAGE_RECORDS.map((record) => {
    if (record.native) {
      return {
        ...record,
        installed: true,
        resolution: "native:@invocorder/recorder"
      };
    }

    const packageRoot = resolveNpmPowerPackageRoot(record.name);

    return {
      ...record,
      installed: packageRoot !== null,
      resolution: packageRoot
    };
  });

  const installedExternal = packages.filter((record) => record.dependency && record.installed).length;
  const missingExternal = packages
    .filter((record) => record.dependency && !record.installed)
    .map((record) => record.name);

  return {
    schema: "invocorder.npm_power_plane.status.v1",
    package_name: "@invocorder/recorder",
    total_bound_packages: packages.length,
    native_packages: packages.filter((record) => record.native).length,
    external_runtime_dependencies: packages.filter((record) => record.dependency).length,
    installed_external_dependencies: installedExternal,
    missing_external_dependencies: missingExternal,
    packages,
    non_claims: {
      package_installation_decides_truth: false,
      package_installation_issues_authority: false,
      package_installation_verifies_final_truth: false,
      package_installation_recognizes_terminal_truth: false,
      package_installation_assigns_recourse: false,
      package_installation_proves_external_reality: false
    }
  };
}

export async function importNpmPowerPackage(name: string): Promise<unknown> {
  const record = INVOCORDER_NPM_POWER_PACKAGE_RECORDS.find((candidate) => candidate.name === name);

  if (!record) {
    throw new Error(`Package is not bound in INVOCORDER npm power plane: ${name}`);
  }

  if (record.native) {
    return {
      native: true,
      name: record.name,
      resolution: "native:@invocorder/recorder"
    };
  }

  const packageJsonPath = resolveNpmPowerPackageJsonPath(record.name);

  if (!packageJsonPath) {
    throw new Error(`Package is not installed in node_modules: ${record.name}`);
  }

  return {
    native: false,
    name: record.name,
    package_root: dirname(packageJsonPath),
    package_json_path: packageJsonPath,
    package_json: JSON.parse(readFileSync(packageJsonPath, "utf8")) as Record<string, unknown>
  };
}
