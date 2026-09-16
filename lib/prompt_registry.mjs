import fs from "node:fs";
import path from "node:path";

export const PROMPT_REGISTRY_SCHEMA = "dizzy.prompt_registry.v1";

/**
 * Resolves a logical prompt path to its physical versioned path based on prompt_registry.json
 */
export function resolvePromptVersion(logicalPath, registryPath = "prompt_registry.json", requestedVersion = null) {
  const defaultRes = { path: logicalPath, version: "default", experiment: null };
  const regPath = path.resolve(process.cwd(), registryPath);
  if (!fs.existsSync(regPath)) return defaultRes;

  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(regPath, "utf8"));
  } catch {
    return defaultRes;
  }

  if (registry.schema_version !== PROMPT_REGISTRY_SCHEMA) return defaultRes;

  const experiment = process.env.DIZZY_PROMPT_EXPERIMENT;
  let targetVersion = requestedVersion || registry.active_version;
  let activeExperiment = null;

  if (experiment && registry.experiments && registry.experiments[experiment]) {
     const exp = registry.experiments[experiment];
     targetVersion = exp.treatment || targetVersion;
     activeExperiment = experiment;
  }

  if (registry.versions && registry.versions[targetVersion]) {
    const versionMap = registry.versions[targetVersion];
    const basename = path.basename(logicalPath);
    if (versionMap[basename]) {
       const mapped = path.resolve(process.cwd(), versionMap[basename]);
       return { path: mapped, version: targetVersion, experiment: activeExperiment };
    }
  }

  return { path: logicalPath, version: targetVersion, experiment: activeExperiment };
}
