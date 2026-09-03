import { connectRedis, makeQueueKeys, workerLoop } from "./lib/queue.mjs";
import { runToolJob } from "./lib/tools.mjs";
import { executeStateMFsm } from "./lib/statem_runbook_bridge.mjs";
import { processBountyIngestJob } from "./lib/bounty_hunter_engine.mjs";
import { assertRuntimeSafetyConfig } from "./lib/runtime_config.mjs";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const prefix = process.env.DIZZY_QUEUE_PREFIX || "dizzy";

assertRuntimeSafetyConfig();

const redis = await connectRedis(redisUrl);
const keys = makeQueueKeys(prefix);

console.log(`[worker] redis=${redisUrl} prefix=${prefix}`);

await workerLoop(redis, keys, async (job) => {
  if (job.type === "tool") return runToolJob(job, { actorId: "worker", sessionId: `worker_job_${job.id || "unknown"}` });
  if (job.type === "runbook" || job.type === "fsm") {
    return executeStateMFsm({
      runbookName: job.runbookName || `worker_runbook_${job.id || "task"}`,
      verificationCommand: job.verificationCommand,
      maxVerificationRetries: job.maxVerificationRetries || 3,
    });
  }
  if (job.type === "bounty_ingest" || job.type === "a2a_bounty_ingest") {
    return processBountyIngestJob(job.payload, {
      executeImmediately: Boolean(job.executeImmediately),
    });
  }
  throw new Error(`Unknown job type: ${job.type}`);
}, {
  onRecovery(summary) {
    if (summary.notification_pending > 0) {
      console.warn(`[worker] notification_pending=${summary.notification_pending} recovered=${summary.recovered} cleared=${summary.cleared}`);
    }
  },
  onRecoveryError(error) {
    console.warn(`[worker] recovery_error=${String(error?.message || error)}`);
  },
  onNotificationPending(cycle) {
    console.warn(`[worker] notification_pending=1 job_id=${cycle.jobId}`);
  },
});
