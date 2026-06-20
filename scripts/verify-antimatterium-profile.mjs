import fs from "node:fs";

const profile = JSON.parse(fs.readFileSync("integrations/antimatterium/ANTIMATTERIUM_EVIDENCE_PROFILE.json", "utf8"));
const record = JSON.parse(fs.readFileSync("examples/antimatterium/mission-run-machine-action-record.json", "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(profile.profile === "INVOCORDER_ANTIMATTERIUM_EVIDENCE_PROFILE", "profile mismatch");
assert(profile.external_stack.owner === "ANTIMATTERIUM", "external stack owner mismatch");
assert(profile.external_stack.core_repository.includes("ANTIMATTERIUM/ANTIMATTERIUM"), "core repo missing");
assert(profile.external_stack.www_site === "https://antimatterium.github.io/WWW/", "www site missing");
assert(profile.external_stack.npm_package.includes("@antimatterium/antimatterium"), "npm package missing");
assert(profile.external_stack.latest_core_release.includes("v0.1.8-antimatterium-cross-stack-bindings"), "core release missing");
assert(profile.external_stack.latest_www_release.includes("v0.1.1-antimatterium-www-cross-stack-surface"), "www release missing");

for (const field of profile.required_record_fields) {
  assert(Object.hasOwn(record, field), `record missing field: ${field}`);
}

assert(record.action === "ANTIMATTERIUM_MISSION_RUN_EXAMPLE", "record action mismatch");
assert(record.external_stack_ref.includes("v0.1.8-antimatterium-cross-stack-bindings"), "record external release mismatch");
assert(record.machine_output_summary.mission_class === 4, "mission class mismatch");
assert(record.machine_output_summary.claim_boundary.includes("not production readiness"), "machine boundary missing");

assert(profile.claim_boundary.claims_current_industrial_antimatter_production === false, "profile production overclaim");
assert(profile.claim_boundary.claims_current_starship_readiness === false, "profile starship overclaim");
assert(profile.claim_boundary.claims_physical_production_instructions === false, "profile instruction overclaim");

assert(record.claim_boundary.claims_current_industrial_antimatter_production === false, "record production overclaim");
assert(record.claim_boundary.claims_current_starship_readiness === false, "record starship overclaim");
assert(record.claim_boundary.claims_physical_production_instructions === false, "record instruction overclaim");

console.log("INVOCORDER_ANTIMATTERIUM_PROFILE_VERIFY_PASS=true");
console.log("ANTIMATTERIUM_EVIDENCE_PROFILE_BOUND=true");
console.log("EXTERNAL_STACK_ACTION_RECORDABLE=true");
console.log("MISSION_RUN_MACHINE_ACTION_RECORD_BOUND=true");
console.log("NO_CURRENT_PRODUCTION_CLAIM=true");
console.log("NO_STARSHIP_CLAIM=true");
console.log("NO_PHYSICAL_PRODUCTION_INSTRUCTIONS=true");
