import fs from "fs";
import path from "path";
import { connectRedis, makeQueueKeys, workerLoop } from "./lib/queue.mjs";
import { runToolJob } from "./lib/tools.mjs";
import { assertRuntimeSafetyConfig } from "./lib/runtime_config.mjs";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const prefix = process.env.DIZZY_QUEUE_PREFIX || "dizzy";

assertRuntimeSafetyConfig();

function runMemoryPruningCycle() {
  const statePath = path.resolve(process.cwd(), "state.json");
  if (!fs.existsSync(statePath)) return;
  try {
    const raw = fs.readFileSync(statePath, "utf8");
    const state = JSON.parse(raw);
    if (!state.memory_nodes) state.memory_nodes = [];

    let modified = false;
    const now = new Date();
    for (const node of state.memory_nodes) {
      if (node.expiresAt && node.status !== "pending_purge") {
        const exp = new Date(node.expiresAt);
        if (exp <= now) {
          node.status = "pending_purge";
          modified = true;
        }
      }
    }

    if (modified) {
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
      console.log("[worker] Memory pruning cycle complete: flagged expired memory nodes as pending_purge.");
    }
  } catch (e) {
    console.error("[worker] Error during memory pruning cycle:", e);
  }
}

// Run memory pruning checks every 24 hours
setInterval(runMemoryPruningCycle, 24 * 60 * 60 * 1000);
// Run once immediately on worker start
runMemoryPruningCycle();

const redis = await connectRedis(redisUrl);
const keys = makeQueueKeys(prefix);

console.log(`[worker] redis=${redisUrl} prefix=${prefix}`);

await workerLoop(redis, keys, async (job) => {
  if (job.type === "tool") return runToolJob(job);
  throw new Error(`Unknown job type: ${job.type}`);
});
