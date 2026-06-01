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
  {
    id: "borrowed_patterns",
    design: ["BORROWED_PATTERNS.md", "External memory-system patterns", "reference material"],
    prompt: ["External Pattern Borrowing", "reference material", "companion ontology"],
  },
];

const PROMPT_FILE_BUDGETS = {
  "CONSTITUTION.md": 6000,
  "IDENTITY.md": 7000,
  "SOUL.md": 13000,
  "HEARTBEAT.md": 9000,
  "TOOLS.md": 12000,
  "USER.md": 9500,
  "PROMPT_CORE.md": 22000,
  "PROMPT_MODES.md": 4000,
};

const DEFAULT_PROMPT_PACK_TOTAL_BUDGET = 72000;

function read(file) {
  try {
    return fs.readFileSync(path.resolve(ROOT, file), "utf8");
  } catch {
    return "";
  }
}

function readJson(file) {
  try {
    return JSON.parse(read(file));
  } catch {
    return null;
  }
}

function includesAny(haystack, needles) {
  const lower = String(haystack || "").toLowerCase();
  return needles.some((needle) => lower.includes(String(needle).toLowerCase()));
}

function includesAll(haystack, needles) {
  const lower = String(haystack || "").toLowerCase();
  return needles.every((needle) => lower.includes(String(needle).toLowerCase()));
}

function byteLen(text) {
  return Buffer.byteLength(String(text ?? ""), "utf8");
}

function main() {
  const errors = [];
  const warnings = [];

  const design = read("DESIGN.md");
  const constitution = read("CONSTITUTION.md");
  const promptCore = read("PROMPT_CORE.md");
  const promptModes = read("PROMPT_MODES.md");
  const promptPackTexts = Object.fromEntries(REQUIRED_FILES.map((file) => [file, read(file)]));
  const promptJoined = Object.values(promptPackTexts).join("\n");

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

  const claimManifest = readJson("scripts/constitutional_claims.json");
  if (!Array.isArray(claimManifest)) {
    errors.push("missing or invalid scripts/constitutional_claims.json");
  } else {
    const seen = new Set();
    for (const claim of claimManifest) {
      const id = String(claim?.id || "").trim();
      if (!id) {
        errors.push("constitutional claim missing id");
        continue;
      }
      if (seen.has(id)) errors.push(`duplicate constitutional claim id: ${id}`);
      seen.add(id);

      if (!includesAll(constitution, claim.constitution || [])) {
        errors.push(`constitutional claim '${id}' missing constitution anchors`);
      }
      if (!includesAll(promptJoined, claim.prompt || [])) {
        errors.push(`constitutional claim '${id}' missing prompt-pack anchors`);
      }
      if (claim.runtime) {
        const files = Array.isArray(claim.runtime.files) ? claim.runtime.files : [];
        const runtimeText = files.map(read).join("\n");
        if (!files.length || !includesAll(runtimeText, claim.runtime.terms || [])) {
          errors.push(`constitutional claim '${id}' missing runtime/test anchors`);
        }
      }
    }
  }

  let totalPromptBytes = 0;
  for (const [file, maxBytes] of Object.entries(PROMPT_FILE_BUDGETS)) {
    const bytes = byteLen(promptPackTexts[file]);
    totalPromptBytes += bytes;
    if (bytes > maxBytes) errors.push(`${file} exceeds prompt budget: ${bytes}/${maxBytes} bytes`);
    else if (bytes > maxBytes * 0.9) warnings.push(`${file} is near prompt budget: ${bytes}/${maxBytes} bytes`);
  }
  if (totalPromptBytes > DEFAULT_PROMPT_PACK_TOTAL_BUDGET) {
    errors.push(`default prompt pack exceeds total budget: ${totalPromptBytes}/${DEFAULT_PROMPT_PACK_TOTAL_BUDGET} bytes`);
  } else if (totalPromptBytes > DEFAULT_PROMPT_PACK_TOTAL_BUDGET * 0.9) {
    warnings.push(`default prompt pack is near total budget: ${totalPromptBytes}/${DEFAULT_PROMPT_PACK_TOTAL_BUDGET} bytes`);
  }

  const stateText = read("state.json");
  if (!includesAny(stateText, ["product_kernel"])) {
    warnings.push("state.json does not expose product_kernel; run node scripts/sync_state.mjs if DESIGN.md changed");
  }
  if (!includesAny(stateText, ["constitutional_kernel", "memory_lifecycle", "promotion_queue"])) {
    warnings.push("state.json does not expose constitutional_kernel/memory_lifecycle/promotion_queue; run node scripts/sync_state.mjs if DESIGN.md changed");
  }
  if (!includesAny(stateText, ["borrowed_patterns"])) {
    warnings.push("state.json does not expose borrowed_patterns; run node scripts/sync_state.mjs if DESIGN.md changed");
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
