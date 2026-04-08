import { connectRedis, makeQueueKeys, workerLoop } from "./lib/queue.mjs";
import { runToolJob } from "./lib/tools.mjs";
import { assertRuntimeSafetyConfig } from "./lib/runtime_config.mjs";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const prefix = process.env.DIZZY_QUEUE_PREFIX || "dizzy";

assertRuntimeSafetyConfig();

const redis = await connectRedis(redisUrl);
const keys = makeQueueKeys(prefix);

console.log(`[worker] redis=${redisUrl} prefix=${prefix}`);

await workerLoop(redis, keys, async (job) => {
  if (job.type === "tool") return runToolJob(job);
  throw new Error(`Unknown job type: ${job.type}`);
});
