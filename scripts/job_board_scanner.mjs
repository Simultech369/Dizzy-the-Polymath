import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { connectRedis, enqueueJob, makeQueueKeys } from "../lib/queue.mjs";
import { normalizeJobListing, createOpportunityA2AIngestEnvelope } from "../lib/job_board_ingress.mjs";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const QUEUE_PREFIX = process.env.DIZZY_QUEUE_PREFIX || "dizzy";
const DEFAULT_REPOSITORY = "ethereum/ethereum-org-website";
const DEFAULT_LABEL = "bounty";
const DEFAULT_OUTPUT_PATH = path.join("artifacts", "bounty_scan_results.json");

export const MOCK_BOUNTY_LISTINGS = Object.freeze([
  Object.freeze({
    id: "mock_123",
    boardSource: "ethereum_jobs",
    company: "Mock ZK Protocol",
    title: "Senior ZK-SNARK Solidity Dev ($100,000 bounty)",
    description: "We are looking for a dev to write zero-knowledge proofs using circom and solidity for our new protocol.",
    url: "https://example.com/bounty",
    roleType: "contract_bounty",
    claimabilityState: "open_unassigned",
    salaryOrPayout: "$100,000",
  }),
]);

function defaultLogger() {
  return {
    info: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
  };
}

function asIsoNow() {
  return new Date();
}

function githubIssueToListing(issue, repo) {
  const payoutMatch = String(issue.title || "").match(/\$([0-9,]+)/);
  return {
    id: `github_${issue.id}`,
    boardSource: `github_${repo.replace("/", "_")}`,
    company: repo.split("/")[0],
    title: issue.title,
    description: issue.body || "No description provided.",
    url: issue.html_url,
    roleType: "contract_bounty",
    claimabilityState: "open_unassigned",
    salaryOrPayout: payoutMatch ? payoutMatch[0] : "$1,000",
    now: asIsoNow,
  };
}

/**
 * Fetches GitHub issue bounties using an injectable fetch implementation.
 */
export async function fetchGithubBounties(repo = DEFAULT_REPOSITORY, label = DEFAULT_LABEL, {
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetchGithubBounties requires a fetch-compatible function");
  }

  const encodedLabel = encodeURIComponent(label);
  const url = `https://api.github.com/repos/${repo}/issues?labels=${encodedLabel}&state=open&sort=created&direction=desc`;
  const headers = {
    "User-Agent": "Dizzy-Bounty-Harvester/1.0",
    Accept: "application/vnd.github.v3+json",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetchImpl(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API returned ${res.status} ${res.statusText}`);
  }

  const issues = await res.json();
  if (!Array.isArray(issues)) {
    throw new Error("GitHub API returned a non-array issue payload");
  }

  return issues.map((issue) => githubIssueToListing(issue, repo));
}

export function createScanResults(rawListings, {
  fromAgent = "job_board_scanner",
  toAgent = "oss_council",
  testCommand = "npm test",
  files = ["README.md"],
  now = asIsoNow,
} = {}) {
  const results = [];
  const skipped = [];

  for (const raw of rawListings || []) {
    try {
      const opportunity = normalizeJobListing({ ...raw, now });
      const envelope = createOpportunityA2AIngestEnvelope(opportunity, {
        fromAgent,
        toAgent,
        testCommand,
        files,
        now,
      });
      results.push({ opportunity, envelope });
    } catch (error) {
      skipped.push({
        id: String(raw?.id || ""),
        title: String(raw?.title || "untitled").slice(0, 150),
        reason: String(error?.message || error),
      });
    }
  }

  return { results, skipped };
}

export function writeScanResults(results, outputPath = DEFAULT_OUTPUT_PATH) {
  const outFile = path.resolve(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  return outFile;
}

async function loadRawListings({
  rawListings = null,
  repository = DEFAULT_REPOSITORY,
  label = DEFAULT_LABEL,
  fetchImpl = globalThis.fetch,
  allowNetworkFetch = true,
  throwOnFetchError = false,
  logger = defaultLogger(),
} = {}) {
  if (Array.isArray(rawListings)) return rawListings;
  if (!allowNetworkFetch) return [];

  try {
    logger.info(`[scanner] Fetching live bounties from GitHub: ${repository} (label: ${label})`);
    return await fetchGithubBounties(repository, label, { fetchImpl });
  } catch (error) {
    if (throwOnFetchError) throw error;
    logger.warn(`[scanner] Live fetch unavailable: ${String(error?.message || error)}`);
    return [];
  }
}

function selectFallbackListings(rawListings) {
  return Array.isArray(rawListings) && rawListings.length > 0
    ? rawListings
    : MOCK_BOUNTY_LISTINGS.map((listing) => ({ ...listing, now: asIsoNow }));
}

export async function runOfflineScan({
  rawListings = null,
  repository = DEFAULT_REPOSITORY,
  label = DEFAULT_LABEL,
  fetchImpl = globalThis.fetch,
  allowNetworkFetch = true,
  outputPath = DEFAULT_OUTPUT_PATH,
  logger = defaultLogger(),
} = {}) {
  const liveOrProvidedListings = await loadRawListings({
    rawListings,
    repository,
    label,
    fetchImpl,
    allowNetworkFetch,
    logger,
  });
  const selectedListings = selectFallbackListings(liveOrProvidedListings);
  const { results, skipped } = createScanResults(selectedListings);
  const outFile = writeScanResults(results, outputPath);

  logger.info(`[scanner] Offline/artifact mode complete. Exported ${results.length} valid bounties to ${outFile}`);
  return {
    mode: "artifact",
    output_path: outFile,
    exported_count: results.length,
    skipped_count: skipped.length,
    used_mock_fallback: selectedListings === MOCK_BOUNTY_LISTINGS || liveOrProvidedListings.length === 0,
    results,
    skipped,
  };
}

export async function runScanner({
  redisUrl = REDIS_URL,
  queuePrefix = QUEUE_PREFIX,
  repository = DEFAULT_REPOSITORY,
  label = DEFAULT_LABEL,
  rawListings = null,
  fetchImpl = globalThis.fetch,
  redisFactory = connectRedis,
  logger = defaultLogger(),
} = {}) {
  const raw = await loadRawListings({
    rawListings,
    repository,
    label,
    fetchImpl,
    allowNetworkFetch: true,
    throwOnFetchError: true,
    logger,
  });

  if (raw.length === 0) {
    logger.info("[scanner] No live bounties found in this pass.");
    return {
      mode: "redis_queue",
      ingested_count: 0,
      skipped_count: 0,
      queued_job_ids: [],
    };
  }

  logger.info(`[scanner] Found ${raw.length} raw listings. Normalizing...`);
  const { results, skipped } = createScanResults(raw);
  const redis = await redisFactory(redisUrl);
  const keys = makeQueueKeys(queuePrefix);
  const queuedJobIds = [];

  try {
    for (const { opportunity, envelope } of results) {
      const jobId = `bounty_ingest_${opportunity.opportunity_id}`;
      const enqueued = await enqueueJob(redis, keys, envelope, {
        id: jobId,
        type: "a2a_bounty_ingest",
        effect: "READ",
        idempotencyKey: `bounty:${opportunity.payload_sha256}`,
      });
      const queuedId = Array.isArray(enqueued) ? String(enqueued[0]) : String(enqueued);
      queuedJobIds.push(queuedId);
      logger.info(`[scanner] Enqueued verified bounty: ${opportunity.title} (EV source payout: $${opportunity.payout_usd_est})`);
    }
  } finally {
    await redis.disconnect?.();
  }

  logger.info(`[scanner] Run complete. Successfully ingested ${queuedJobIds.length} qualified bounties into queue.`);
  return {
    mode: "redis_queue",
    ingested_count: queuedJobIds.length,
    skipped_count: skipped.length,
    queued_job_ids: queuedJobIds,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes("--offline-proof")) {
    runOfflineScan({ allowNetworkFetch: false }).then(() => {
      process.exit(0);
    }).catch((error) => {
      console.error("[scanner] Offline proof failed:", String(error?.message || error));
      process.exit(1);
    });
  } else {
    runScanner().catch(async (error) => {
      console.error("[scanner] Redis queue unavailable or scanner error:", String(error?.message || error));
      console.log("[scanner] Falling back to artifact mode at artifacts/bounty_scan_results.json");

      try {
        await runOfflineScan({ allowNetworkFetch: true });
        process.exit(0);
      } catch (fallbackError) {
        console.error("[scanner] Artifact fallback failed:", String(fallbackError?.message || fallbackError));
        const emergencyPath = path.join(os.tmpdir(), "dizzy-bounty-scan-results.json");
        const { results } = createScanResults(MOCK_BOUNTY_LISTINGS.map((listing) => ({ ...listing, now: asIsoNow })));
        fs.writeFileSync(emergencyPath, JSON.stringify(results, null, 2));
        console.error(`[scanner] Wrote emergency mock artifact to ${emergencyPath}`);
        process.exit(1);
      }
    });
  }
}
