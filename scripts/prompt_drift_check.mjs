import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const REQUIRED_FILES = [
  "CONSTITUTION.md",
  "IDENTITY.md",
  "SOUL.md",
  "HEARTBEAT.md",
  "TOOLS.md",
  "USER.md",
  "PROMPT_CORE.md",
  "PROMPT_MODES.md",
];

const DESIGN_TO_PROMPT_SIGNALS = [
  {
    id: "constitutional_kernel",
    design: ["Constitutional kernel", "CONSTITUTION.md", "non-negotiable"],
    prompt: ["compact kernel", "constitutional boundaries", "ontology stays bounded"],
  },
  {
    id: "trust_zones",
    design: ["trust zone", "paid_public", "private_self"],
    prompt: ["trust zone", "paid/public", "private self"],
  },
  {
    id: "runtime_constitution",
    design: ["runtime-governing doctrine", "default prompt pack"],
    prompt: ["runtime constitution", "authoritative runtime constitution"],
  },
  {
    id: "prompt_modes",
    design: ["DIZZY_BREVITY_MODE", "DIZZY_AFFECT_MODE", "DIZZY_REINFORCEMENT_MODE"],
    prompt: ["brevity_mode", "affect_mode", "reinforcement_mode"],
  },
  {
    id: "product_kernel",
    design: ["Product Kernel", "disciplined continuity of judgment"],
    prompt: ["continuity-and-judgment", "continuity and judgment"],
  },
  {
    id: "mechanism_sieve",
    design: ["anti-extraction", "capability", "capture risk"],
    prompt: ["mechanism sieve", "ownership", "capture risk"],
  },
  {
    id: "memory_lifecycle",
    design: ["Memory has lifecycle metadata", "confidence", "revocation"],
    prompt: ["Memory Lifecycle", "confidence", "revocation path"],
  },
  {
    id: "private_commercial_separation",
    design: ["private core", "Commercial operation", "private-assistant continuity"],
    prompt: ["Private continuity is non-commercial substrate", "Commercial objectives"],
  },
];

function read(file) {
  try {
    return fs.readFileSync(path.resolve(ROOT, file), "utf8");
  } catch {
    return "";
  }
}

function includesAny(haystack, needles) {
  const lower = String(haystack || "").toLowerCase();
  return needles.some((needle) => lower.includes(String(needle).toLowerCase()));
}

function main() {
  const errors = [];
  const warnings = [];

  const design = read("DESIGN.md");
  const constitution = read("CONSTITUTION.md");
  const promptCore = read("PROMPT_CORE.md");
  const promptModes = read("PROMPT_MODES.md");
  const promptJoined = `${promptCore}\n${promptModes}`;

  for (const file of REQUIRED_FILES) {
    const abs = path.resolve(ROOT, file);
    if (!fs.existsSync(abs)) errors.push(`missing prompt-pack file: ${file}`);
  }

  for (const signal of DESIGN_TO_PROMPT_SIGNALS) {
    const inDesign = includesAny(`${design}\n${constitution}`, signal.design);
    const inPrompt = includesAny(promptJoined, signal.prompt);
    if (inDesign && !inPrompt) {
      errors.push(`design signal '${signal.id}' is missing from PROMPT_CORE.md/PROMPT_MODES.md`);
    }
  }

  const stateText = read("state.json");
  if (!includesAny(stateText, ["product_kernel"])) {
    warnings.push("state.json does not expose product_kernel; run node scripts/sync_state.mjs if DESIGN.md changed");
  }
  if (!includesAny(stateText, ["constitutional_kernel", "memory_lifecycle", "promotion_queue"])) {
    warnings.push("state.json does not expose constitutional_kernel/memory_lifecycle/promotion_queue; run node scripts/sync_state.mjs if DESIGN.md changed");
  }

  if (errors.length) {
    console.error("PROMPT_DRIFT_FAIL");
    for (const e of errors) console.error(`- ${e}`);
    for (const w of warnings) console.error(`warning: ${w}`);
    process.exit(1);
  }

  console.log("PROMPT_DRIFT_OK");
  for (const w of warnings) console.log(`warning: ${w}`);
}

main();
