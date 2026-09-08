import crypto from "node:crypto";
import {
  parseBountyTask,
  calculateBountyEv,
  assessBountyEligibility,
  sanitizeBountyText,
  sanitizeSourceUrl,
  createBountyA2AIngestEnvelope,
} from "./bounty_hunter_engine.mjs";

export const JOB_BOARD_INGRESS_SCHEMA = "dizzy.job_board_ingress.v1";
export const OPPORTUNITY_RECEIPT_SCHEMA = "dizzy.opportunity_receipt.v1";

export const SUPPORTED_BOARDS = Object.freeze([
  "midnight_network",
  "dragonfly_xyz",
  "block_xyz",
  "solana_jobs",
  "avax_jobs",
  "ethereum_jobs",
  "web3_career",
  "cryptocurrencyjobs",
  "cryptojobslist",
  "beincrypto",
  "jobstash",
  "remote3",
  "crypto_careers",
]);

export const TECHNICAL_DOMAINS = Object.freeze({
  ZK_PRIVACY: ["zero-knowledge", "zk-snark", "zk-stark", "circom", "halo2", "plonk", "midnight", "privacy"],
  PROTOCOL_RUST: ["rust", "solana", "anchor", "substrate", "near", "cosmwasm", "tokio", "wasm"],
  SMART_CONTRACTS_EVM: ["solidity", "evm", "foundry", "hardhat", "yul", "ethereum", "defi", "smart contract"],
  AI_AGENTIC_SYSTEMS: ["llm", "multi-agent", "autonomous agent", "rag", "evals", "prompt engineering", "langchain", "antigravity", "codex", "fsm"],
  DISTRIBUTED_SYSTEMS: ["consensus", "p2p", "raft", "byzantine", "gossip", "networking", "distributed storage", "libp2p"],
});

export function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex").toUpperCase();
}

/**
 * Classifies job or bounty descriptions into technical domains and extracts relevant skill tags.
 */
export function extractTechnicalDomains(text) {
  const clean = String(text || "").toLowerCase();
  const matchedDomains = [];
  const extractedSkills = [];

  for (const [domain, keywords] of Object.entries(TECHNICAL_DOMAINS)) {
    const hits = keywords.filter((kw) => clean.includes(kw));
    if (hits.length > 0) {
      matchedDomains.push(domain);
      extractedSkills.push(...hits);
    }
  }

  return {
    domains: [...new Set(matchedDomains)],
    skills: [...new Set(extractedSkills)],
  };
}

/**
 * Normalizes raw job board listings into structured, sanitized opportunity objects.
 */
export function normalizeJobListing({
  id,
  boardSource,
  company,
  title,
  location = "Remote",
  salaryOrPayout = null,
  payoutUsd = null,
  description,
  url,
  roleType = "contract_bounty",
  claimabilityState = "unverified",
  requiredStack = [],
  proofRequirements = [],
  now = () => new Date(),
} = {}) {
  const safeBoard = String(boardSource || "generic_web3").toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const safeCompany = String(company || "Unknown Entity").trim().slice(0, 100);
  const safeTitle = String(title || "Untitled Role").trim().slice(0, 150);
  const cleanDesc = sanitizeBountyText(description || "");
  const safeUrl = sanitizeSourceUrl(url);
  const { domains, skills } = extractTechnicalDomains(`${safeTitle} ${cleanDesc}`);

  // Blend extracted skills with explicit requiredStack
  const mergedStack = [...new Set([...skills, ...(Array.isArray(requiredStack) ? requiredStack : [])])];

  const rawSalaryOrPayout = salaryOrPayout == null ? "" : String(salaryOrPayout).trim();
  const hasExplicitPayout = payoutUsd !== null && payoutUsd !== undefined && String(payoutUsd).trim() !== "";
  const explicitPayout = hasExplicitPayout && Number.isFinite(Number(payoutUsd))
    ? Math.max(0, Number(payoutUsd))
    : null;

  // Calculate alignment score based on domain density
  let alignmentScore = 0.50;
  if (domains.includes("AI_AGENTIC_SYSTEMS")) alignmentScore += 0.25;
  if (domains.includes("ZK_PRIVACY") || domains.includes("PROTOCOL_RUST")) alignmentScore += 0.20;
  if (domains.includes("DISTRIBUTED_SYSTEMS")) alignmentScore += 0.15;
  alignmentScore = Math.min(1.0, alignmentScore);

  const payloadSha256 = sha256Hex(JSON.stringify({
    id,
    board: safeBoard,
    company: safeCompany,
    title: safeTitle,
    roleType,
    claimabilityState,
    domains,
    skills: mergedStack,
    proofRequirements,
    payoutUsd: explicitPayout,
    url: safeUrl,
  }));

  return {
    schema_version: JOB_BOARD_INGRESS_SCHEMA,
    opportunity_id: String(id || `opp_${Date.now()}`),
    board_source: safeBoard,
    company: safeCompany,
    title: safeTitle,
    role_type: String(roleType || "contract_bounty"),
    claimability_state: String(claimabilityState || "unverified"),
    location: String(location).trim(),
    salary_or_payout: rawSalaryOrPayout || null,
    payout_usd_est: explicitPayout,
    technical_domains: domains,
    skill_tags: mergedStack,
    proof_requirements: Array.isArray(proofRequirements) ? proofRequirements : [],
    alignment_score: Number(alignmentScore.toFixed(2)),
    sanitized_description: cleanDesc,
    source_url: safeUrl,
    payload_sha256: payloadSha256,
    ingested_at: now().toISOString(),
  };
}

/**
 * Transforms a high-resonance opportunity into an actionable StateM task packet.
 */
export function convertOpportunityToBountyTask(opportunity, {
  testCommand = "npm test",
  files = ["README.md", "proposal_spec.md"],
  benchmarkMode = false,
} = {}) {
  if (opportunity.alignment_score < 0.60) {
    return {
      qualified: false,
      eligibility_state: "needs_verification",
      reason: "Alignment score below minimum threshold (0.60)",
    };
  }
  const targetSlug = String(opportunity.company || "unknown-entity")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown-entity";

  const bountyTask = parseBountyTask({
    id: `task_${opportunity.opportunity_id}`,
    title: `${opportunity.company}: ${opportunity.title}`,
    description: opportunity.sanitized_description,
    platform: opportunity.board_source,
    repository: `target/${targetSlug}`,
    sourceUrl: opportunity.source_url,
    roleType: opportunity.role_type || "bounty",
    claimabilityState: opportunity.claimability_state || "unverified",
    proofRequirements: opportunity.proof_requirements || [],
    requiredStack: opportunity.skill_tags || [],
    testCommand,
    payoutUsd: opportunity.payout_usd_est ?? 0,
    difficulty: opportunity.technical_domains.includes("ZK_PRIVACY") ? "hard" : "medium",
    files,
  });

  const eligibility = assessBountyEligibility({
    claimabilityState: opportunity.claimability_state,
    payoutUsd: opportunity.payout_usd_est,
    proofRequirements: opportunity.proof_requirements,
    benchmarkMode,
  });

  const evReceipt = calculateBountyEv({
    payoutUsd: opportunity.payout_usd_est ?? 0,
    difficulty: bountyTask.difficulty,
    hasReproductionTests: eligibility.has_reproduction_tests,
    benchmarkMode,
  });

  const normalizedRecommendation = eligibility.dispatchable
    ? evReceipt.recommendation
    : eligibility.eligibility_state === "benchmark"
      ? "EVAL_BENCHMARK_ONLY"
      : evReceipt.recommendation === "REJECT_NEGATIVE_EV"
        ? evReceipt.recommendation
        : "NEEDS_VERIFICATION";

  return {
    qualified: eligibility.dispatchable || eligibility.eligibility_state === "benchmark",
    dispatchable: eligibility.dispatchable,
    eligibility_state: eligibility.eligibility_state,
    eligibility_reason: eligibility.reason,
    bounty_task: bountyTask,
    ev_receipt: {
      ...evReceipt,
      recommendation: normalizedRecommendation,
    },
  };
}

/**
 * Transforms a qualified normalized opportunity directly into a sealed A2A bounty-ingest envelope.
 */
export function createOpportunityA2AIngestEnvelope(opportunity, {
  fromAgent = "job_board_scanner",
  toAgent = "oss_council",
  testCommand = "npm test",
  files = ["README.md", "proposal_spec.md"],
  benchmarkMode = false,
  now = () => new Date(),
} = {}) {
  const converted = convertOpportunityToBountyTask(opportunity, { testCommand, files, benchmarkMode });
  if (!converted.qualified) {
    throw new Error(`Cannot create A2A ingest for unqualified opportunity: ${converted.eligibility_reason || converted.reason || "eligibility requires review"}`);
  }

  return createBountyA2AIngestEnvelope({
    bountyTask: converted.bounty_task,
    triageReceipt: converted.ev_receipt,
    fromAgent,
    toAgent,
    now,
  });
}
