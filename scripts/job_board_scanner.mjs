import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { connectRedis, enqueueJob, makeQueueKeys } from "../lib/queue.mjs";
import { normalizeJobListing, createOpportunityA2AIngestEnvelope } from "../lib/job_board_ingress.mjs";
import { sanitizeRepositoryRef } from "../lib/bounty_hunter_engine.mjs";
import {
  adaptScanResultToBridgeRequest,
  validateBridgeResponse,
} from "../lib/node_python_council_bridge_contract.mjs";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const QUEUE_PREFIX = process.env.DIZZY_QUEUE_PREFIX || "dizzy";
const DEFAULT_REPOSITORY = "ethereum/ethereum-org-website";
const DEFAULT_LABEL = "bounty";
const DEFAULT_OUTPUT_PATH = path.join("artifacts", "bounty_scan_results.json");
const DEFAULT_REHEARSAL_OUTPUT_PATH = path.join("artifacts", "bounty_scan_bridge_rehearsal.json");
const DEFAULT_COUNCIL_ENGINE_DIR = process.env.USERPROFILE
  ? path.join(process.env.USERPROFILE, ".gemini", "antigravity", "scratch", "council_engine")
  : path.resolve("../scratch/council_engine");

export const MOCK_BOUNTY_LISTINGS = Object.freeze([
  Object.freeze({
    id: "mock_123",
    boardSource: "ethereum_jobs",
    company: "Mock ZK Protocol",
    title: "Senior ZK-SNARK Solidity Dev ($100,000 bounty)",
    description: "We are looking for a dev to write zero-knowledge proofs using circom and solidity for our new protocol.",
    url: "https://github.com/mock-zk/protocol/issues/123",
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

function sanitizeGithubRepositorySlug(repository) {
  const safeRef = sanitizeRepositoryRef(repository);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(safeRef)) {
    throw new Error("GitHub bounty fetch requires an owner/repo repository slug");
  }
  return safeRef;
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

  const safeRepo = sanitizeGithubRepositorySlug(repo);
  const encodedLabel = encodeURIComponent(label);
  const url = `https://api.github.com/repos/${safeRepo}/issues?labels=${encodedLabel}&state=open&sort=created&direction=desc`;
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

  return issues.map((issue) => githubIssueToListing(issue, safeRepo));
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

export function buildBridgeRequestsFromScanResults(scanResults, {
  requestedReceiptAuthority = "rehearsal_receipt",
} = {}) {
  const requests = [];
  for (const item of scanResults || []) {
    try {
      const request = adaptScanResultToBridgeRequest(item, { requestedReceiptAuthority });
      requests.push(request);
    } catch {
      // skip un-adaptable items
    }
  }
  return requests;
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

export async function runScannerBridgeRehearsal({
  scanResults = null,
  rawListings = null,
  repository = DEFAULT_REPOSITORY,
  label = DEFAULT_LABEL,
  outputPath = DEFAULT_REHEARSAL_OUTPUT_PATH,
  councilEngineDir = process.env.COUNCIL_ENGINE_DIR || DEFAULT_COUNCIL_ENGINE_DIR,
  pythonBin = process.env.PYTHON_BIN || "python",
  logger = defaultLogger(),
} = {}) {
  let effectiveResults = scanResults;
  if (!effectiveResults || effectiveResults.length === 0) {
    const scan = await runOfflineScan({
      rawListings,
      repository,
      label,
      allowNetworkFetch: false,
      logger,
    });
    effectiveResults = scan.results;
  }

  const bridgeRequests = buildBridgeRequestsFromScanResults(effectiveResults, {
    requestedReceiptAuthority: "rehearsal_receipt",
  });

  if (bridgeRequests.length === 0) {
    logger.warn("[scanner:bridge] No bridge requests generated from scan results.");
    return {
      mode: "bridge_rehearsal",
      executed_count: 0,
      requests_count: 0,
      receipts: [],
      output_path: null,
      summary: null,
    };
  }

  const runnerScript = councilEngineDir ? path.join(councilEngineDir, "bridge_rehearsal_runner.py") : null;
  const canExecuteSubprocess = runnerScript && fs.existsSync(runnerScript);

  const receipts = [];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy-bridge-scan-"));

  try {
    for (let i = 0; i < bridgeRequests.length; i++) {
      const bridgeRequest = bridgeRequests[i];
      if (canExecuteSubprocess) {
        const inputPath = path.join(tempDir, `req_${i}.json`);
        const outReceiptPath = path.join(tempDir, `receipt_${i}.json`);
        fs.writeFileSync(inputPath, JSON.stringify(bridgeRequest, null, 2), "utf8");

        logger.info(`[scanner:bridge] Executing sidecar bridge runner for request: ${bridgeRequest.request_id}`);
        execFileSync(pythonBin, [runnerScript, inputPath, outReceiptPath], {
          encoding: "utf8",
          timeout: 30_000,
        });

        if (!fs.existsSync(outReceiptPath)) {
          throw new Error(`Sidecar bridge runner did not produce output receipt at ${outReceiptPath}`);
        }

        const rawReceipt = JSON.parse(fs.readFileSync(outReceiptPath, "utf8"));
        const validated = validateBridgeResponse(rawReceipt, bridgeRequest);
        if (!validated.ok) {
          throw new Error(`Sidecar response failed bridge contract validation: ${validated.errors.join("; ")}`);
        }
        receipts.push(rawReceipt);
      } else {
        logger.warn(`[scanner:bridge] Python council engine runner not found at ${runnerScript}; skipped sidecar execution`);
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const resolvedOut = path.resolve(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
  const summaryPayload = {
    schema_version: "dizzy.bounty_scan_bridge_rehearsal.v1",
    generated_at: new Date().toISOString(),
    rehearsal_authority: "rehearsal_receipt",
    requests_count: bridgeRequests.length,
    receipts_count: receipts.length,
    requests: bridgeRequests,
    receipts,
  };
  fs.writeFileSync(resolvedOut, JSON.stringify(summaryPayload, null, 2), "utf8");
  logger.info(`[scanner:bridge] Rehearsal complete. Wrote ${receipts.length} verified bridge receipts to ${resolvedOut}`);

  return {
    mode: "bridge_rehearsal",
    executed_count: receipts.length,
    requests_count: bridgeRequests.length,
    receipts,
    output_path: resolvedOut,
    summary: summaryPayload,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const isOfflineProof = process.argv.includes("--offline-proof");
  const isBridgeRehearsal = process.argv.includes("--bridge-rehearsal");

  if (isBridgeRehearsal) {
    runScannerBridgeRehearsal().then(() => {
      process.exit(0);
    }).catch((error) => {
      console.error("[scanner] Bridge rehearsal failed:", String(error?.message || error));
      process.exit(1);
    });
  } else if (isOfflineProof) {
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
