import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { StateMCheckpointEngine } from "../lib/statem_checkpoint.mjs";
import { executeStateMFsm } from "../lib/statem_runbook_bridge.mjs";

const testFilePath = path.join(process.cwd(), "runtime/checkpoints/test_statem_checkpoints.jsonl");

try {
  console.log("[test:statem-checkpoint] Starting suite...");
  
  if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);

  const engine = new StateMCheckpointEngine(testFilePath);

  let planCount = 0;
  let executeCount = 0;
  let verifyCount = 0;
  let handoffCount = 0;
  let rollbackCount = 0;

  let stopAt = null;
  let isCancel = false;

  async function testRunbook() {
    return await executeStateMFsm({
      jobId: "test-job-123",
      checkpointEngine: engine,
      runbookName: "test-runbook",
      cancelIntent: isCancel,
      planHandler: async () => {
        planCount++;
        if (stopAt === "plan") throw new Error("SUSPEND");
        return { ok: true };
      },
      executeHandler: async () => {
        executeCount++;
        if (stopAt === "execute") throw new Error("SUSPEND");
        return { ok: true };
      },
      verifyHandler: async () => {
        verifyCount++;
        if (stopAt === "verify") throw new Error("SUSPEND");
        // Succeed on 2nd attempt
        return { ok: verifyCount >= 2 };
      },
      handoffHandler: async () => {
        handoffCount++;
        if (stopAt === "handoff") throw new Error("SUSPEND");
        return { ok: true };
      },
      rollbackHandler: async () => {
        rollbackCount++;
        return { ok: true };
      }
    });
  }

  // 1. Run until execute
  stopAt = "execute";
  const res1 = await testRunbook();
  assert.equal(res1.ok, false);
  assert.equal(res1.receipt.terminal_state, "execute");
  assert.equal(planCount, 1);
  assert.equal(executeCount, 1);
  assert.equal(verifyCount, 0);

  // 2. Resume and run until verify
  stopAt = "verify";
  const res2 = await testRunbook();
  assert.equal(res2.ok, false);
  assert.equal(res2.receipt.terminal_state, "verify");
  // Because the state was "execute", the engine starts loop at "execute" and increments executeCount again!
  assert.equal(planCount, 1);
  assert.equal(executeCount, 2); 
  assert.equal(verifyCount, 1);

  // 3. Suspend and Cancel
  isCancel = true;
  stopAt = null;
  const res3 = await testRunbook();
  assert.equal(res3.ok, false);
  assert.equal(res3.receipt.status, "CANCELLED");
  assert.equal(res3.receipt.terminal_state, "CANCELLED");
  assert.equal(rollbackCount, 1);
  assert.equal(planCount, 1);
  assert.equal(executeCount, 2); 
  assert.equal(verifyCount, 1); 

  console.log("  [PASS] Checkpoint resume preserves FSM transitions and successfully completes.");

  console.log("\n[test:statem-checkpoint] ALL TESTS PASSED CLEANLY.\n");

} finally {
  if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
}
