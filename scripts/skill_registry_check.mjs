import { discoverLocalSkills } from "../lib/skill_registry.mjs";
import fs from "fs";
import path from "path";

const registry = discoverLocalSkills();
if (registry.issues.length) {
  console.error("SKILL_REGISTRY_INVALID");
  for (const issue of registry.issues) console.error(`- ${issue}`);
  process.exit(1);
}

const active = registry.skills.filter((skill) => skill.status === "active").length;
const restricted = registry.skills.filter((skill) => skill.status === "restricted").length;
const standby = registry.skills.filter((skill) => skill.status === "standby").length;
const ledger = fs.readFileSync(path.resolve(process.cwd(), "context-packs/skill-intake-ledger.md"), "utf8").replace(/\r\n/g, "\n");
const sections = ledger.split(/^#### /m).slice(1);
for (const section of sections) {
  const title = section.split("\n", 1)[0].trim();
  const status = section.match(/^status:\s*(.+)$/m)?.[1]?.trim() || "";
  const destination = section.match(/^integrated into:\s*(.+)$/m)?.[1]?.trim() || "";
  if (status === "integrated" && !destination) {
    console.error(`SKILL_LEDGER_INVALID ${title}: integrated entry lacks destination`);
    process.exit(1);
  }
  if (status !== "integrated" && destination) {
    console.error(`SKILL_LEDGER_INVALID ${title}: destination exists for status ${status || "missing"}`);
    process.exit(1);
  }
}
console.log(`SKILL_REGISTRY_OK total=${registry.skills.length} active=${active} restricted=${restricted} standby=${standby} reviewed_at=${registry.reviewed_at}`);
