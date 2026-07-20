import assert from "assert";
import fs from "fs";
import path from "path";
import os from "os";

import { ActivePolicyEngine } from "../lib/active_policy_engine.mjs";

const statePath = path.join(os.tmpdir(), `temp-active-policy-state-${Date.now()}.json`);
const configPath = path.join(os.tmpdir(), `temp-active-policy-config-${Date.now()}.json`);

try {
  const writerEngine = new ActivePolicyEngine({ statePath, configPath });
  const readerEngine = new ActivePolicyEngine({ statePath, configPath });

  writerEngine.state.containment_active = true;
  writerEngine.saveState();

  assert.strictEqual(
    readerEngine.isWriteSuspended(),
    true,
    "separate durable-write policy readers must observe persisted active containment"
  );
  assert.strictEqual(
    readerEngine.isBridgeVetoActive(),
    true,
    "separate bridge policy readers must observe persisted active containment"
  );

  readerEngine.resolveContainment("Operator verified resolution reason requirement");

  const resolvedState = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.strictEqual(resolvedState.containment_active, false, "resolve must persistently clear containment");
  assert.strictEqual(
    writerEngine.isWriteSuspended(),
    false,
    "separate durable-write policy readers must observe persisted containment resolution"
  );

  console.log("ACTIVE_POLICY_STATE_OK");
} finally {
  fs.rmSync(statePath, { force: true });
  fs.rmSync(configPath, { force: true });
}
