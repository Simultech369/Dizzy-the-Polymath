import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { resolvePromptVersion, PROMPT_REGISTRY_SCHEMA } from "../lib/prompt_registry.mjs";

const testRegistry = path.join(process.cwd(), "test_prompt_registry.json");

try {
  console.log("[test:prompt-registry] Starting suite...");
  
  const payload = {
    schema_version: PROMPT_REGISTRY_SCHEMA,
    active_version: "v1",
    versions: {
      "v1": {
        "PROMPT_CORE.md": "archive/PROMPT_CORE_v1.md"
      },
      "v2": {
        "PROMPT_CORE.md": "archive/PROMPT_CORE_v2.md"
      }
    },
    experiments: {
      "test_exp": {
        "treatment": "v2"
      }
    }
  };

  fs.writeFileSync(testRegistry, JSON.stringify(payload), "utf8");

  // 1. Default resolution uses active_version
  const res1 = resolvePromptVersion("PROMPT_CORE.md", "test_prompt_registry.json");
  assert.equal(res1.version, "v1");
  assert.equal(res1.path, path.resolve(process.cwd(), "archive/PROMPT_CORE_v1.md"));
  assert.equal(res1.experiment, null);

  // 2. Unmapped file falls back to logical path
  const res2 = resolvePromptVersion("CONSTITUTION.md", "test_prompt_registry.json");
  assert.equal(res2.version, "v1");
  assert.equal(res2.path, "CONSTITUTION.md");

  // 3. Explicit requestedVersion override
  const res3 = resolvePromptVersion("PROMPT_CORE.md", "test_prompt_registry.json", "v2");
  assert.equal(res3.version, "v2");
  assert.equal(res3.path, path.resolve(process.cwd(), "archive/PROMPT_CORE_v2.md"));

  // 4. Experiment override
  process.env.DIZZY_PROMPT_EXPERIMENT = "test_exp";
  const res4 = resolvePromptVersion("PROMPT_CORE.md", "test_prompt_registry.json");
  assert.equal(res4.version, "v2");
  assert.equal(res4.path, path.resolve(process.cwd(), "archive/PROMPT_CORE_v2.md"));
  assert.equal(res4.experiment, "test_exp");
  
  delete process.env.DIZZY_PROMPT_EXPERIMENT;

  console.log("  [PASS] Prompt Registry successfully resolves versions and experiments.");
  console.log("\n[test:prompt-registry] ALL TESTS PASSED CLEANLY.\n");

} finally {
  if (fs.existsSync(testRegistry)) fs.unlinkSync(testRegistry);
}
