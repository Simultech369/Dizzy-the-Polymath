import fs from "fs";
import path from "path";

import { parseFrontmatter } from "./markdown_frontmatter.mjs";

const ALLOWED_ZONES = new Set(["private_self", "trusted_collaborator"]);
const MANIFEST_V1_KEYS = new Set([
  "name",
  "description",
  "version",
  "provides",
  "required_tools",
  "permissions",
  "external_services",
  "validation_path",
  "rollback_path",
  "receipt_fields",
]);

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(String).map((x) => x.trim()).filter(Boolean);
  return String(value || "").split(",").map((x) => x.trim()).filter(Boolean);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function triggerTermMatches(query, term) {
  const parts = String(term || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!parts.length) return false;
  const pattern = parts.map(escapeRegExp).join("\\s+");
  return new RegExp(`(^|[^a-z0-9])${pattern}(?=$|[^a-z0-9])`, "i").test(String(query || ""));
}

function loadManifest(rootDir) {
  const filePath = path.join(rootDir, "registry.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeScalar(value) {
  return String(value || "").trim();
}

function skillManifestFromFrontmatter(data = {}) {
  return {
    version: normalizeScalar(data?.version),
    provides: normalizeScalar(data?.provides),
    required_tools: normalizeList(data?.required_tools),
    permissions: normalizeScalar(data?.permissions),
    external_services: normalizeScalar(data?.external_services),
    validation_path: normalizeScalar(data?.validation_path),
    rollback_path: normalizeScalar(data?.rollback_path),
    receipt_fields: normalizeList(data?.receipt_fields),
  };
}

export function discoverLocalSkills(options = {}) {
  const rootDir = path.resolve(options.rootDir || path.join(process.cwd(), "skills"));
  const manifest = loadManifest(rootDir);
  const configured = manifest.skills && typeof manifest.skills === "object" ? manifest.skills : {};
  const skills = [];
  const issues = [];

  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const filePath = path.join(rootDir, entry.name, "SKILL.md");
    if (!fs.existsSync(filePath)) {
      issues.push(`${entry.name}: missing SKILL.md`);
      continue;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const { data, body } = parseFrontmatter(raw);
    const name = String(data?.name || "").trim();
    const description = String(data?.description || "").trim();
    const config = configured[entry.name];

    if (!name) issues.push(`${entry.name}: missing frontmatter name`);
    if (name && name !== entry.name) issues.push(`${entry.name}: frontmatter name '${name}' does not match directory`);
    if (!description) issues.push(`${entry.name}: missing frontmatter description`);
    for (const key of Object.keys(data || {})) {
      if (!MANIFEST_V1_KEYS.has(key)) issues.push(`${entry.name}: unknown frontmatter key '${key}'`);
    }
    if (!body.trim()) issues.push(`${entry.name}: empty skill body`);
    if (!config) issues.push(`${entry.name}: missing registry disposition`);

    skills.push({
      name: name || entry.name,
      description,
      status: String(config?.status || "unreviewed"),
      trigger_terms: Array.isArray(config?.trigger_terms) ? config.trigger_terms.map(String) : [],
      path: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
      manifest: skillManifestFromFrontmatter(data),
      body: body.trim(),
    });
  }

  for (const name of Object.keys(configured)) {
    if (!skills.some((skill) => skill.name === name)) issues.push(`${name}: registry entry has no SKILL.md`);
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));
  return {
    version: manifest.version,
    reviewed_at: manifest.reviewed_at,
    default_max_selected: manifest.default_max_selected || 3,
    default_max_bytes: manifest.default_max_bytes || 6000,
    skills,
    issues,
  };
}

function explicitSkillNames(runtimeContext = {}) {
  return normalizeList(runtimeContext.skills ?? runtimeContext.skill_names);
}

export function selectLocalSkills(query, options = {}) {
  const trustZone = String(options.trustZone || "").trim().toLowerCase();
  const registry = discoverLocalSkills(options);
  const requested = explicitSkillNames(options.runtimeContext);
  const maxSelected = Math.max(1, Number(options.maxSelected || registry.default_max_selected || 3));
  const maxBytes = Math.max(1, Number(options.maxBytes || registry.default_max_bytes || 6000));
  if (!ALLOWED_ZONES.has(trustZone)) {
    return {
      registry,
      selected: [],
      requested,
      rejected: requested.map((name) => ({ name, reason: "trust_zone_blocks_local_skills" })),
      mode: "blocked",
      max_selected: maxSelected,
      max_bytes: maxBytes,
      prompt_bytes: 0,
    };
  }

  const available = new Map(registry.skills.filter((skill) => ["active", "restricted", "standby"].includes(skill.status)).map((skill) => [skill.name, skill]));
  const rejected = [];
  let selected = [];
  let mode = "automatic";

  if (requested.length) {
    mode = "explicit";
    for (const name of requested) {
      const skill = available.get(name);
      if (skill) selected.push({ ...skill, match_score: 100, matched_terms: ["explicit_request"] });
      else rejected.push({ name, reason: "unknown_or_unapproved_skill" });
    }
  } else {
    selected = [...available.values()].filter((skill) => skill.status === "active").map((skill) => {
      const matched = skill.trigger_terms.filter((term) => triggerTermMatches(query, term));
      return { ...skill, match_score: matched.length, matched_terms: matched };
    }).filter((skill) => skill.match_score > 0)
      .sort((a, b) => b.match_score - a.match_score || a.name.localeCompare(b.name));
  }

  const bounded = [];
  for (const skill of selected) {
    if (bounded.length >= maxSelected) {
      rejected.push({ name: skill.name, reason: "skill_count_budget_exceeded" });
      continue;
    }
    const candidate = [...bounded, skill];
    const candidateBytes = Buffer.byteLength(formatSelectedSkills({ selected: candidate, mode }), "utf8");
    if (candidateBytes > maxBytes) {
      rejected.push({ name: skill.name, reason: "skill_prompt_byte_budget_exceeded" });
      continue;
    }
    bounded.push(skill);
  }

  selected = bounded;
  const promptBytes = Buffer.byteLength(formatSelectedSkills({ selected, mode }), "utf8");
  return {
    registry,
    selected,
    requested,
    rejected,
    mode,
    max_selected: maxSelected,
    max_bytes: maxBytes,
    prompt_bytes: promptBytes,
  };
}

export function formatSelectedSkills(selection) {
  if (!selection?.selected?.length) return "";
  return [
    "",
    "=== SELECTED LOCAL SKILLS | authority=task_workflow_below_constitution ===",
    `selection_mode=${selection.mode}`,
    ...selection.selected.map((skill) => [
      `--- ${skill.name} [status=${skill.status} path=${skill.path}] ---`,
      skill.description,
      skill.body,
    ].join("\n")),
    "=== END SELECTED LOCAL SKILLS ===",
  ].join("\n");
}
