import crypto from "node:crypto";
import { createA2AMessage } from "./a2a_mailbox_bridge.mjs";
import {
  exportStateMRunbook,
  executeStateMFsm,
  ALLOWED_VERIFICATION_COMMANDS,
  DEFAULT_VERIFICATION_COMMAND,
} from "./statem_runbook_bridge.mjs";

export const BOUNTY_TASK_SCHEMA = "dizzy.bounty_task.v1";
export const BOUNTY_A2A_INGEST_SCHEMA = "dizzy.bounty_a2a_ingest.v1";
export const BOUNTY_TRIAGE_RECEIPT_SCHEMA = "dizzy.bounty_triage_receipt.v1";
export const BOUNTY_SOLVE_RECEIPT_SCHEMA = "dizzy.bounty_solve_receipt.v1";
export const BOUNTY_VULNERABILITY_RECEIPT_SCHEMA = "dizzy.bounty_vulnerability_receipt.v1";
export const BOUNTY_INGEST_JOB_RESULT_SCHEMA = "dizzy.bounty_ingest_job_result.v1";

export const ALLOWED_BOUNTY_SOURCE_HOSTS = Object.freeze([
  "github.com",
  "gitlab.com",
  "hackerone.com",
  "immunefi.com",
  "code4rena.com",
  "sherlock.xyz",
  "cantina.xyz",
  "opire.dev",
  "algora.io",
  "cheapbugs.net",
  "midnight.network",
  "jobs.solana.com",
  "jobs.avax.network",
  "ethereumjobboard.com",
  "block.xyz",
  "jobs.dragonfly.xyz",
  "web3.career",
  "cryptocurrencyjobs.co",
  "cryptojobslist.com",
  "jobstash.xyz",
  "remote3.co",
  "beincrypto.com",
  "crypto-careers.com",
]);

export const ALLOWED_REPOSITORY_HOSTS = Object.freeze([
  "github.com",
  "gitlab.com",
]);

export const VALID_CLAIMABILITY_STATES = Object.freeze([
  "unverified",
  "open_unassigned",
  "open_needs_assignment",
  "assigned_elsewhere",
  "closed",
  "monitor_only",
]);

export function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex").toUpperCase();
}

function cleanList(values, { maxItems = 32, maxChars = 240 } = {}) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((value) => value.slice(0, maxChars))
    .slice(0, maxItems);
}

function normalizeSlug(value, fallback) {
  const slug = String(value || fallback || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || fallback;
}

function normalizeClaimabilityState(value) {
  const state = normalizeSlug(value, "unverified");
  return VALID_CLAIMABILITY_STATES.includes(state) ? state : "unverified";
}

function getOwn(source, key, fallback = undefined) {
  if (!source || typeof source !== "object") return fallback;
  return Object.prototype.hasOwnProperty.call(source, key) ? source[key] : fallback;
}

function canonicalHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host.startsWith("www.") ? host.slice(4) : host;
}

function parseHttpsUrl(rawValue, fieldName) {
  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw new Error(`Unsafe bounty ${fieldName}: invalid URL`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`Unsafe bounty ${fieldName}: only https URLs are allowed`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`Unsafe bounty ${fieldName}: embedded credentials are not allowed`);
  }
  if (parsed.port) {
    throw new Error(`Unsafe bounty ${fieldName}: explicit ports are not allowed`);
  }
  parsed.hash = "";
  return parsed;
}

export function sanitizeSourceUrl(sourceUrl, { allowEmpty = true } = {}) {
  const raw = String(sourceUrl || "").trim();
  if (!raw) {
    if (allowEmpty) return "";
    throw new Error("Unsafe bounty sourceUrl: missing URL");
  }
  if (raw.length > 500) {
    throw new Error("Unsafe bounty sourceUrl: URL exceeds 500 characters");
  }

  const parsed = parseHttpsUrl(raw, "sourceUrl");
  const host = canonicalHost(parsed.hostname);
  if (!ALLOWED_BOUNTY_SOURCE_HOSTS.includes(host)) {
    throw new Error(`Unsafe bounty sourceUrl: host '${parsed.hostname}' is not allowlisted`);
  }
  return parsed.toString();
}

export function sanitizeRepositoryRef(repository) {
  const raw = String(repository || "unknown/repo").trim();
  if (!raw) return "unknown/repo";
  if (raw.length > 200) {
    throw new Error("Unsafe bounty repository: reference exceeds 200 characters");
  }
  if (/[\0`"'|&;$<>]/.test(raw) || /(^|[\/\\])\.\.([\/\\]|$)/.test(raw) || /\$[A-Za-z_({]/.test(raw) || /%[A-Za-z_][A-Za-z0-9_]*%/.test(raw)) {
    throw new Error("Unsafe bounty repository: shell, environment, or traversal marker detected");
  }

  if (/^https:\/\//i.test(raw)) {
    const parsed = parseHttpsUrl(raw, "repository");
    const host = canonicalHost(parsed.hostname);
    if (!ALLOWED_REPOSITORY_HOSTS.includes(host)) {
      throw new Error(`Unsafe bounty repository: host '${parsed.hostname}' is not allowlisted`);
    }
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length !== 2 || !segments.every((segment) => /^[A-Za-z0-9_.-]+$/.test(segment))) {
      throw new Error("Unsafe bounty repository: URL must point to an owner/repo root");
    }
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  }

  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(raw)) {
    return raw;
  }
  if (/^target\/[a-z0-9][a-z0-9-]{0,80}$/.test(raw)) {
    return raw;
  }
  throw new Error("Unsafe bounty repository: expected owner/repo, target/<slug>, or allowlisted https repo URL");
}

export function sanitizeArtifactPath(filePath) {
  const raw = String(filePath || "").trim();
  if (!raw) throw new Error("Unsafe bounty target file: empty path");
  if (raw.length > 260) throw new Error("Unsafe bounty target file: path exceeds 260 characters");
  if (/^[A-Za-z]:[\\/]/.test(raw) || raw.startsWith("/") || raw.startsWith("\\") || /^https?:\/\//i.test(raw)) {
    throw new Error("Unsafe bounty target file: absolute paths and URLs are not allowed");
  }
  if (raw.includes("\\") || /[\0`"'|&;$<>*?]/.test(raw) || /\$[A-Za-z_({]/.test(raw) || /%[A-Za-z_][A-Za-z0-9_]*%/.test(raw)) {
    throw new Error("Unsafe bounty target file: shell, environment, or Windows path marker detected");
  }
  const normalized = raw.replace(/\/+/g, "/").replace(/^\.\//, "");
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized.includes("/../") || normalized.endsWith("/..")) {
    throw new Error("Unsafe bounty target file: path traversal is not allowed");
  }
  if (normalized.split("/").some((part) => part === "." || part === ".." || part === "")) {
    throw new Error("Unsafe bounty target file: malformed relative path");
  }
  return normalized;
}

export function sanitizeArtifactPaths(files, { maxItems = 64 } = {}) {
  if (!Array.isArray(files)) return [];
  const sanitized = files.map((file) => sanitizeArtifactPath(file));
  return [...new Set(sanitized)].slice(0, maxItems);
}

export function sanitizeVerificationCommand(testCommand, {
  defaultCommand = ALLOWED_VERIFICATION_COMMANDS[0] || DEFAULT_VERIFICATION_COMMAND,
} = {}) {
  const raw = String(testCommand || "").trim().replace(/\s+/g, " ");
  if (!raw) return defaultCommand;
  if (raw === DEFAULT_VERIFICATION_COMMAND || ALLOWED_VERIFICATION_COMMANDS.includes(raw)) {
    return raw;
  }
  if (/[|&;$<>`]/.test(raw) || /\$\(|\${/.test(raw)) {
    throw new Error("Unsafe bounty test_command: shell metacharacters are not allowed");
  }
  throw new Error("Unsafe bounty test_command: command must exactly match the allowlist");
}

export function validateBountyTaskBoundary(bountyTask) {
  if (!bountyTask || bountyTask.schema_version !== BOUNTY_TASK_SCHEMA) {
    throw new Error("Invalid bounty payload: missing or malformed dizzy.bounty_task.v1");
  }
  sanitizeRepositoryRef(bountyTask.repository);
  sanitizeSourceUrl(bountyTask.source_url);
  sanitizeArtifactPaths(bountyTask.target_files);
  sanitizeVerificationCommand(bountyTask.test_command);
  return true;
}

/**
 * Sanitizes untrusted text from external bounty / job board descriptions,
 * stripping adversarial prompt overrides, hidden instructions, and shell injections.
 */
export function sanitizeBountyText(text) {
  if (!text || typeof text !== "string") return "";
  let clean = text
    .replace(/<system_prompt_override>[\s\S]*?<\/system_prompt_override>/gi, "[REDACTED_OVERRIDE]")
    .replace(/ignore\s+all\s+previous\s+instructions/gi, "[REDACTED_INSTRUCTION]")
    .replace(/\brm\s+-rf\b/gi, "[BLOCKED_COMMAND]")
    .replace(/`([^`]*[\$\&\|\;][^`]*)`/g, "[BLOCKED_SHELL_EXPANSION]")
    .replace(/javascript:/gi, "[BLOCKED_URI]")
    .trim();
  return clean;
}

/**
 * Parses and validates an external bounty or SWE-bench problem description.
 */
export function parseBountyTask(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const id = getOwn(source, "id");
  const title = getOwn(source, "title");
  const description = getOwn(source, "description");
  const platform = getOwn(source, "platform", "swe_bench");
  const repository = getOwn(source, "repository");
  const sourceUrl = getOwn(source, "sourceUrl", "");
  const roleType = getOwn(source, "roleType", "bounty");
  const claimabilityState = getOwn(source, "claimabilityState", "unverified");
  const proofRequirements = getOwn(source, "proofRequirements", []);
  const requiredStack = getOwn(source, "requiredStack", []);
  const testCommand = getOwn(source, "testCommand");
  const payoutUsd = getOwn(source, "payoutUsd", 0);
  const difficulty = getOwn(source, "difficulty", "medium");
  const files = getOwn(source, "files", []);

  const safeId = String(id || `bounty_${Date.now()}`).trim();
  const safeTitle = String(title || "Untitled Bounty").trim().slice(0, 200);
  const cleanDescription = sanitizeBountyText(description || "");
  const safePlatform = normalizeSlug(platform, "swe_bench");
  const safeRepo = sanitizeRepositoryRef(repository);
  const safeSourceUrl = sanitizeSourceUrl(sourceUrl);
  const safeRoleType = normalizeSlug(roleType, "bounty");
  const safeClaimabilityState = normalizeClaimabilityState(claimabilityState);
  const safeProofRequirements = cleanList(proofRequirements);
  const safeRequiredStack = cleanList(requiredStack);
  const safeTestCmd = sanitizeVerificationCommand(testCommand);
  const safePayout = Number.isFinite(Number(payoutUsd)) ? Math.max(0, Number(payoutUsd)) : 0;
  const safeFiles = sanitizeArtifactPaths(files);

  const payloadSha256 = sha256Hex(JSON.stringify({
    id: safeId,
    title: safeTitle,
    description: cleanDescription,
    platform: safePlatform,
    repository: safeRepo,
    sourceUrl: safeSourceUrl,
    roleType: safeRoleType,
    claimabilityState: safeClaimabilityState,
    proofRequirements: safeProofRequirements,
    requiredStack: safeRequiredStack,
    testCommand: safeTestCmd,
    payoutUsd: safePayout,
    difficulty,
    files: safeFiles,
  }));

  return {
    schema_version: BOUNTY_TASK_SCHEMA,
    bounty_id: safeId,
    title: safeTitle,
    sanitized_description: cleanDescription,
    platform: safePlatform,
    repository: safeRepo,
    source_url: safeSourceUrl,
    role_type: safeRoleType,
    claimability_state: safeClaimabilityState,
    proof_requirements: safeProofRequirements,
    required_stack: safeRequiredStack,
    test_command: safeTestCmd,
    payout_usd: safePayout,
    difficulty,
    target_files: safeFiles,
    payload_sha256: payloadSha256,
    parsed_at: new Date().toISOString(),
  };
}

/**
 * Calculates the Expected Value (EV) for triaging incoming bounties.
 * EV = P(solve) * payout - compute_cost
 */
export function calculateBountyEv({
  payoutUsd = 0,
  difficulty = "medium",
  hasReproductionTests = true,
  estimatedTokens = 50_000,
  tokenCostPer1k = 0.003, // blended average
} = {}) {
  const payout = Math.max(0, Number(payoutUsd) || 0);
  const estimatedCost = (Number(estimatedTokens) / 1000) * Number(tokenCostPer1k);

  // Baseline solve probability by difficulty
  let baseProb = 0.65;
  if (difficulty === "easy") baseProb = 0.85;
  if (difficulty === "hard") baseProb = 0.40;
  if (difficulty === "critical" || difficulty === "complex") baseProb = 0.25;

  // Bonus for clear reproduction tests
  const prob = hasReproductionTests ? Math.min(0.95, baseProb * 1.2) : baseProb * 0.7;
  const evUsd = (prob * payout) - estimatedCost;

  let recommendation = "DISPATCH";
  if (evUsd <= 0 && payout > 0) recommendation = "REJECT_NEGATIVE_EV";
  else if (prob < 0.30) recommendation = "PARK_HIGH_RISK";
  else if (payout === 0) recommendation = "EVAL_BENCHMARK_ONLY"; // SWE-bench evaluation run

  return {
    schema_version: BOUNTY_TRIAGE_RECEIPT_SCHEMA,
    payout_usd: payout,
    difficulty,
    has_reproduction_tests: Boolean(hasReproductionTests),
    solve_probability: Number(prob.toFixed(3)),
    estimated_cost_usd: Number(estimatedCost.toFixed(4)),
    expected_value_usd: Number(evUsd.toFixed(2)),
    recommendation,
    triaged_at: new Date().toISOString(),
  };
}

/**
 * Creates a specialized 4-phase StateM runbook tailored for solving coding bounties.
 */
export function createBountyStateMRunbook(bountyTask) {
  const name = `bounty-solve-${bountyTask.bounty_id || "task"}`;
  const repository = sanitizeRepositoryRef(bountyTask.repository);
  const targetFiles = sanitizeArtifactPaths(bountyTask.target_files);
  const rawCommand = String(bountyTask.test_command || "").trim().replace(/\s+/g, " ");
  const verificationCommand = sanitizeVerificationCommand(rawCommand);
  const proofRequirements = Array.isArray(bountyTask.proof_requirements) && bountyTask.proof_requirements.length > 0
    ? bountyTask.proof_requirements.join(", ")
    : "local deterministic verification receipt";

  const customPrompts = {
    plan: `Isolate root cause in repository '${repository}'. Confirm claimability '${bountyTask.claimability_state || "unverified"}', reproduce the issue, and identify the minimal code change required.`,
    execute: `Implement minimal clean-room fix in target files: [${targetFiles.join(", ")}]. Enforce zero license contamination.`,
    verify: `Execute allowed verification command: '${verificationCommand}'. Required proof: ${proofRequirements}. Target original command: '${rawCommand || "none"}'. Assert 100% test pass and zero regressions before handoff.`,
    handoff: `Package git diff patch, verification receipts, clean-room notes, and draft summary. Public submission or maintainer outreach requires explicit operator approval.`,
  };

  return exportStateMRunbook({
    name,
    verificationCommand,
    customPrompts,
  });
}

/**
 * Creates the sealed A2A bounty-ingest contract used by board scanners
 * to hand qualified opportunities into the council / StateM queue.
 */
export function createBountyA2AIngestEnvelope({
  bountyTask,
  triageReceipt = null,
  fromAgent = "subagent_researcher",
  toAgent = "oss_council",
  trustZone = "trusted_collaborator",
  priority = "high",
  parentTaskId = null,
  notes = "",
  now = () => new Date(),
} = {}) {
  if (!bountyTask || bountyTask.schema_version !== BOUNTY_TASK_SCHEMA) {
    throw new Error("Bounty A2A ingest requires a parsed dizzy.bounty_task.v1 payload");
  }

  const payload = {
    schema_version: BOUNTY_A2A_INGEST_SCHEMA,
    bounty_task: bountyTask,
    triage_receipt: triageReceipt,
    state_machine: {
      recommended_runbook_name: `bounty-solve-${bountyTask.bounty_id || "task"}`,
      lifecycle: ["plan", "execute", "verify", "handoff"],
      execute_verify_repair_loop: true,
      verify_before_handoff: true,
      max_auto_repair_cycles: 3,
    },
    council_directives: {
      economic_triage: "required_before_expensive_model_dispatch",
      asymmetric_deliberation: {
        builder_lane: "minimal_clean_room_patch",
        breaker_lane: "hostile_edge_case_and_regression_tests",
      },
      ingress_scrubbing: "sanitize_untrusted_text_before_context_entry",
      clean_room_sealing: "required_before_submission_packet",
    },
    proof_boundaries: [
      "board_scan_is_not_live_coverage_without_current_scan_receipt",
      "handoff_is_blocked_until_verification_passes",
      "public_submission_requires_operator_approval",
      "private_memory_must_not_enter_public_packets",
    ],
    operator_approval_required_for: [
      "public_submission",
      "claiming_bounty",
      "maintainer_outreach",
      "external_broadcast",
    ],
    notes: String(notes || "").trim(),
  };

  const payloadString = JSON.stringify(payload);
  if (String(trustZone || "").toLowerCase() === "outside_contact" && /private_memory|credential|secret|api[_-]?key/i.test(payloadString)) {
    throw new Error("Bounty A2A boundary violation: outside_contact ingest cannot contain private memory or credentials");
  }

  const envelope = createA2AMessage({
    id: `a2a_bounty_ingest_${bountyTask.bounty_id || "task"}`,
    senderId: fromAgent,
    recipientId: toAgent,
    messageType: "bounty_alert",
    payload,
    trustZone,
    priority,
    parentTaskId: parentTaskId || bountyTask.bounty_id,
    now,
  });

  return {
    schema_version: BOUNTY_A2A_INGEST_SCHEMA,
    envelope,
    payload_sha256: envelope.payload_sha256,
    ingest_contract_sha256: sha256Hex(JSON.stringify(envelope)),
    created_at: envelope.created_at,
  };
}

/**
 * Scans code snippets for common vulnerability patterns (smart contract and backend).
 */
export function scanAdversarialVulnerabilities(codeSnippet, { targetType = "smart_contract" } = {}) {
  const code = String(codeSnippet || "");
  const findings = [];

  if (targetType === "smart_contract" || targetType === "solidity") {
    // 1. Reentrancy check: state change alongside external call without nonReentrant guard
    if (/\.call\{value:|\.transfer\(|\.send\(/.test(code) && /balances\[|msg\.sender\]\s*=|owner\s*=/.test(code) && !/nonReentrant|reentrancyGuard/i.test(code)) {
      findings.push({
        type: "REENTRANCY_RISK",
        severity: "HIGH",
        description: "External value transfer detected alongside state mutation without nonReentrant guard.",
      });
    }

    // 2. Unchecked return value
    if (/\.call\(|\.delegatecall\(/.test(code) && !/require\(|if\s*\(!/.test(code)) {
      findings.push({
        type: "UNCHECKED_LOW_LEVEL_CALL",
        severity: "MEDIUM",
        description: "Low-level call return value is not explicitly validated.",
      });
    }

    // 3. tx.origin authorization
    if (/tx\.origin/.test(code)) {
      findings.push({
        type: "TX_ORIGIN_AUTHENTICATION",
        severity: "HIGH",
        description: "Use of tx.origin for authentication is vulnerable to phishing attacks. Use msg.sender.",
      });
    }
  }

  // Backend / General
  if (/child_process\.exec\s*\(|eval\s*\(/.test(code)) {
    findings.push({
      type: "UNSAFE_CODE_EXECUTION",
      severity: "CRITICAL",
      description: "Direct use of exec() or eval() without shell-less argument arrays exposes command injection.",
    });
  }

  const receipt = {
    schema_version: BOUNTY_VULNERABILITY_RECEIPT_SCHEMA,
    target_type: targetType,
    findings_count: findings.length,
    findings,
    clean: findings.length === 0,
    snippet_sha256: sha256Hex(code),
    scanned_at: new Date().toISOString(),
  };

  return receipt;
}

/**
 * Processes a bounty ingest queue job or sealed A2A envelope,
 * performing schema validation, EV triage, StateM runbook compilation,
 * and optional immediate FSM execution.
 */
export async function processBountyIngestJob(jobPayload, {
  executeImmediately = false,
  now = () => new Date(),
} = {}) {
  const payload = typeof jobPayload === "string" ? JSON.parse(jobPayload) : (jobPayload || {});

  // 1. Resolve bounty task from A2A envelope, ingest wrapper, or raw payload
  let bountyTask = null;
  let existingTriage = null;

  if (payload.envelope && payload.envelope.payload) {
    bountyTask = payload.envelope.payload.bounty_task;
    existingTriage = payload.envelope.payload.triage_receipt;
  } else if (payload.schema_version === BOUNTY_A2A_INGEST_SCHEMA) {
    bountyTask = payload.bounty_task;
    existingTriage = payload.triage_receipt;
  } else if (payload.schema_version === BOUNTY_TASK_SCHEMA) {
    bountyTask = payload;
  } else {
    // Attempt parse
    bountyTask = parseBountyTask(payload);
  }

  if (!bountyTask || bountyTask.schema_version !== BOUNTY_TASK_SCHEMA) {
    throw new Error("Invalid bounty payload: missing or malformed dizzy.bounty_task.v1");
  }
  validateBountyTaskBoundary(bountyTask);

  // 2. Perform or verify EV triage
  const triageReceipt = existingTriage || calculateBountyEv({
    payoutUsd: bountyTask.payout_usd,
    difficulty: bountyTask.difficulty,
    hasReproductionTests: Boolean(bountyTask.test_command),
  });

  // 3. Check qualification recommendations
  const isDispatchable = triageReceipt.recommendation === "DISPATCH" || triageReceipt.recommendation === "EVAL_BENCHMARK_ONLY";

  if (!isDispatchable) {
    return {
      schema_version: BOUNTY_INGEST_JOB_RESULT_SCHEMA,
      bounty_id: bountyTask.bounty_id,
      qualified: false,
      status: "REJECTED",
      reason: `Triage recommendation '${triageReceipt.recommendation}' prevents automated dispatch`,
      triage_receipt: triageReceipt,
      runbook: null,
      fsm_receipt: null,
      processed_at: now().toISOString(),
    };
  }

  // 4. Generate StateM 4-phase Runbook
  const runbook = createBountyStateMRunbook(bountyTask);

  let fsmReceipt = null;
  if (executeImmediately) {
    const fsmExec = await executeStateMFsm({
      runbookName: runbook.receipt.runbook_name,
      verificationCommand: runbook.receipt.verification_command,
      maxVerificationRetries: 2,
    });
    fsmReceipt = fsmExec.receipt;
  }

  return {
    schema_version: BOUNTY_INGEST_JOB_RESULT_SCHEMA,
    bounty_id: bountyTask.bounty_id,
    qualified: true,
    status: executeImmediately && fsmReceipt ? (fsmReceipt.status === "PASSED" ? "COMPLETED" : "FAILED") : "QUALIFIED_AND_ROUTED",
    triage_receipt: triageReceipt,
    runbook,
    fsm_receipt: fsmReceipt,
    processed_at: now().toISOString(),
  };
}
