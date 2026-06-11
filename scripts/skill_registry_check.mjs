import { discoverLocalSkills } from "../lib/skill_registry.mjs";

const registry = discoverLocalSkills();
if (registry.issues.length) {
  console.error("SKILL_REGISTRY_INVALID");
  for (const issue of registry.issues) console.error(`- ${issue}`);
  process.exit(1);
}

const active = registry.skills.filter((skill) => skill.status === "active").length;
const restricted = registry.skills.filter((skill) => skill.status === "restricted").length;
const standby = registry.skills.filter((skill) => skill.status === "standby").length;
console.log(`SKILL_REGISTRY_OK total=${registry.skills.length} active=${active} restricted=${restricted} standby=${standby} reviewed_at=${registry.reviewed_at}`);
