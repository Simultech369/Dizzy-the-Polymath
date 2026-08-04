/**
 * scripts/test_active_integration.mjs
 * -----------------------------------
 * Test suite to verify all the active integration changes:
 * - Active Policy Engine real append path, candidate exclusion, write block suspension, bridge veto, resolution reasons
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import http from "http";

import { detectFrictionAnomaly } from "../lib/friction_anomaly_detector.mjs";
import { ActivePolicyEngine } from "../lib/active_policy_engine.mjs";
import { assertDurableWriteAllowed } from "../lib/durable_write_policy.mjs";
import { appendFrictionSync } from "../lib/friction_ledger.mjs";
import { conversationPathForKey } from "../lib/client_continuity.mjs";
import { isPrivateLanBackendHost } from "../lib/dispatch.mjs";

console.log("Starting active integration tests...");

// Ensure runtime directory exists
fs.mkdirSync(path.join(process.cwd(), "runtime"), { recursive: true });
// Define root disposable temp dir inside runtime directory
const DISPOSABLE_ROOT = fs.mkdtempSync(path.join(process.cwd(), "runtime", ".test-run-"));
console.log(`Using isolated disposable root: ${DISPOSABLE_ROOT}`);

function snapshotDiskTree(root) {
  const snapshot = new Map();

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(root, fullPath).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        snapshot.set(relPath, { type: "dir" });
        walk(fullPath);
      } else if (entry.isFile()) {
        const bytes = fs.readFileSync(fullPath);
        snapshot.set(relPath, {
          type: "file",
          size: bytes.length,
          hex: bytes.toString("hex")
        });
      } else {
        snapshot.set(relPath, { type: "other" });
      }
    }
  }

  walk(root);
  return snapshot;
}

function assertNoDiskTreeDiff(before, after, label) {
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  const diffs = [];
  for (const relPath of paths) {
    if (!before.has(relPath)) {
      diffs.push(`added:${relPath}`);
      continue;
    }
    if (!after.has(relPath)) {
      diffs.push(`removed:${relPath}`);
      continue;
    }
    const beforeEntry = JSON.stringify(before.get(relPath));
    const afterEntry = JSON.stringify(after.get(relPath));
    if (beforeEntry !== afterEntry) diffs.push(`changed:${relPath}`);
  }
  assert.deepStrictEqual(diffs, [], `${label} must not mutate files or directories`);
}

// -------------------------------------------------------------
// Test: Private LAN Backend Override Classifier
// -------------------------------------------------------------
console.log("Running Test: Private LAN Backend Override Classifier...");
assert.strictEqual(isPrivateLanBackendHost("10.0.0.1"), true, "10/8 must be allowed for LAN override");
assert.strictEqual(isPrivateLanBackendHost("172.16.0.1"), true, "172.16/12 lower bound must be allowed");
assert.strictEqual(isPrivateLanBackendHost("172.31.255.255"), true, "172.16/12 upper bound must be allowed");
assert.strictEqual(isPrivateLanBackendHost("192.168.1.20"), true, "192.168/16 must be allowed");
assert.strictEqual(isPrivateLanBackendHost("169.254.10.20"), true, "169.254/16 link-local IPv4 must be allowed");
assert.strictEqual(isPrivateLanBackendHost("fc00::1"), true, "fc00::/7 private IPv6 lower range must be allowed");
assert.strictEqual(isPrivateLanBackendHost("fd12::1"), true, "fc00::/7 private IPv6 upper range must be allowed");
assert.strictEqual(isPrivateLanBackendHost("fe80::1"), true, "fe80::/10 link-local IPv6 must be allowed");
assert.strictEqual(isPrivateLanBackendHost("ollama.local"), false, ".local hostnames must not be trusted without literal private IP resolution");
assert.strictEqual(isPrivateLanBackendHost("172.15.255.255"), false, "172.15/16 must not be allowed");
assert.strictEqual(isPrivateLanBackendHost("172.32.0.1"), false, "172.32/16 must not be allowed");
assert.strictEqual(isPrivateLanBackendHost("169.255.0.1"), false, "169.255/16 must not be allowed");
assert.strictEqual(isPrivateLanBackendHost("2001:4860:4860::8888"), false, "Public IPv6 must not be allowed");
assert.strictEqual(isPrivateLanBackendHost("8.8.8.8"), false, "WAN IPs must not be allowed");
assert.strictEqual(isPrivateLanBackendHost("fc-public.example.com"), false, "WAN hostnames with private-looking prefixes must not be allowed");
assert.strictEqual(isPrivateLanBackendHost("external-cloud-api-provider.com"), false, "WAN hostnames must not be allowed");
console.log("-> Test passed.");

// -------------------------------------------------------------
// Test: Real Append API & Candidate Exclusion integration test (AP-01, AP-02, AP-03, AP-05, AP-06, AP-07, AP-08, AP-09)
// -------------------------------------------------------------
console.log("Running Test: Real Append API & Active Policy engine integration...");
const tempLedgerPath = path.join(DISPOSABLE_ROOT, "friction_ledger.jsonl");
const tempConfigPath = path.join(DISPOSABLE_ROOT, "active_policy_config.json");
const tempStatePath = path.join(DISPOSABLE_ROOT, "active_policy_state.json");
const tempQuarantineDirForEngine = path.join(DISPOSABLE_ROOT, "engine_quarantine");

fs.mkdirSync(tempQuarantineDirForEngine, { recursive: true });

// Setup config with varied min_history_entries
const testConfig = {
  enabled: true,
  z_score_threshold: 3.0,
  min_history_entries: 5,
  containment_actions: {
    suspend_durable_writes: true,
    veto_quarantined_bridges: true
  },
  escalation_contact: "operator@localhost"
};
fs.writeFileSync(tempConfigPath, JSON.stringify(testConfig, null, 2), "utf8");

// Setup environment overrides so the policy engine reads the isolated test files
process.env.DIZZY_FRICTION_PATH = tempLedgerPath;
process.env.DIZZY_QUARANTINE_PATH = tempQuarantineDirForEngine;
process.env.DIZZY_ACTIVE_POLICY_CONFIG_PATH = tempConfigPath;
process.env.DIZZY_ACTIVE_POLICY_STATE_PATH = tempStatePath;

try {
  // Setup separate reader and writer engine instances configured with temp paths
  const engine = new ActivePolicyEngine({
    configPath: tempConfigPath,
    statePath: tempStatePath,
    ledgerPath: tempLedgerPath,
    quarantinePath: tempQuarantineDirForEngine
  });

  // Inject a mock quarantined bridge inside the temporary quarantine folder
  const bridgeId = "test_bridge_id";
  const bridgeFile = path.join(tempQuarantineDirForEngine, `bridge_${bridgeId}.json`);
  fs.writeFileSync(bridgeFile, JSON.stringify({
    id: bridgeId,
    source_file: "source.md",
    target_file: "target.md",
    status: "quarantined",
    approved_by_operator: false
  }, null, 2), "utf8");

  // 1. Append 5 normal low-friction entries
  for (let i = 0; i < 5; i++) {
    appendFrictionSync({
      friction_type: "api_slowdown",
      severity: 2,
      frequency: "once",
      description: `Normal slow down instance ${i}`,
      timestamp: new Date(Date.now() - (10 - i) * 60000).toISOString()
    }, { filePath: tempLedgerPath });
  }

  // Refresh engine to inspect status: containment should be false
  engine.refreshState();
  assert.strictEqual(engine.state.containment_active, false, "Containment must be inactive with only baseline entries");
  assert.strictEqual(engine.isWriteSuspended(), false, "Writes must not be suspended");

  // 2. Append a chronic severity-10 anomaly (weight = 30)
  // If the candidate was in its own baseline, MAD scale would be large, preventing containment.
  // With baseline exclusion, the baseline has MAD=0, falling back to epsilon=0.1.
  // The candidate Z-score will be (30 - 2) / 0.1 = 280, triggering containment.
  appendFrictionSync({
    friction_type: "consensus_staleness",
    severity: 10,
    frequency: "chronic",
    description: "Critical chronic consensus stall",
    timestamp: new Date().toISOString()
  }, { filePath: tempLedgerPath });

  engine.refreshState();
  assert.strictEqual(engine.state.containment_active, true, "Containment must be active after chronic anomaly append");
  assert.strictEqual(engine.isWriteSuspended(), true, "Writes must be suspended after anomaly");
  assert(engine.state.trigger_reason.includes("consensus_staleness"), "Trigger reason must mention chronic anomaly type");

  // 3. Verify that assertDurableWriteAllowed now blocks writes
  assert.throws(() => {
    assertDurableWriteAllowed({
      kind: "friction",
      payload: { text: "attempted write" },
      trustZone: "private_self"
    });
  }, /durable write blocked: write_capabilities_suspended_containment_active/, "Assert write should throw write suspended");

  // 4. Verify that bridge veto ran and marked the quarantined bridge as vetoed
  const bridgeContent = JSON.parse(fs.readFileSync(bridgeFile, "utf8"));
  assert.strictEqual(bridgeContent.status, "vetoed", "Quarantined bridge status must be vetoed");
  assert(bridgeContent.veto_reason.includes("containment active"), "Veto reason must be logged");

  // 5. Verify resolution reason constraints: empty reason should be rejected
  assert.throws(() => {
    engine.resolveContainment("");
  }, /resolution reason is required/, "Empty containment resolution reason must be rejected");

  assert.throws(() => {
    engine.resolveContainment("   ");
  }, /resolution reason is required/, "Whitespace resolution reason must be rejected");

  // 6. Resolve containment with a valid reason
  const resolutionReason = "Verified consensus stability and restored state paths";
  engine.resolveContainment(resolutionReason);

  engine.refreshState();
  assert.strictEqual(engine.state.containment_active, false, "Containment must be inactive after resolution");
  assert.strictEqual(engine.isWriteSuspended(), false, "Writes must be allowed after resolution");

  const lastHistory = engine.state.containment_history[engine.state.containment_history.length - 1];
  assert.strictEqual(lastHistory.resolved_by_operator, true, "History should reflect operator resolution");
  assert.strictEqual(lastHistory.resolved_reason, resolutionReason, "Resolution reason must be correctly stored in history");

  console.log("-> Test passed.");
} finally {
  delete process.env.DIZZY_FRICTION_PATH;
  delete process.env.DIZZY_QUARANTINE_PATH;
  delete process.env.DIZZY_ACTIVE_POLICY_CONFIG_PATH;
  delete process.env.DIZZY_ACTIVE_POLICY_STATE_PATH;
  fs.rmSync(tempQuarantineDirForEngine, { recursive: true, force: true });
}

// -------------------------------------------------------------
// Test: Router Receipt MVP integration
// -------------------------------------------------------------
console.log("Running Test: Router Receipt MVP integration...");

let capturedMockRequest = null;

// Start mock loopback Ollama HTTP provider
const mockProvider = http.createServer((req, res) => {
  if (req.url === "/v1/chat/completions" && req.method === "POST") {
    let bodyData = "";
    req.on("data", chunk => { bodyData += chunk; });
    req.on("end", () => {
      try {
        capturedMockRequest = {
          url: req.url,
          method: req.method,
          headers: req.headers,
          body: JSON.parse(bodyData)
        };
      } catch {
        capturedMockRequest = { url: req.url, method: req.method, headers: req.headers, rawBody: bodyData };
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        choices: [{ message: { role: "assistant", content: "Mock local assistant response" } }]
      }));
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

await new Promise((resolve) => mockProvider.listen(0, "127.0.0.1", resolve));
const mockPort = mockProvider.address().port;
const mockOllamaUrl = `http://127.0.0.1:${mockPort}/v1`;

// Setup environment overrides to isolate all runtime logs and receipts under DISPOSABLE_ROOT
const testReceiptsFile = path.join(DISPOSABLE_ROOT, "test_router_receipts.jsonl");
const testConvoDir = path.join(DISPOSABLE_ROOT, "conversations");
const testDeletionsFile = path.join(DISPOSABLE_ROOT, "deletions.jsonl");
const testExecHistory = path.join(DISPOSABLE_ROOT, "exec_history.jsonl");
const oldRouterBackend = process.env.DIZZY_CHAT_BACKEND;

process.env.DIZZY_ROUTER_RECEIPT_PATH = testReceiptsFile;
process.env.DIZZY_CONVERSATION_DIR = testConvoDir;
process.env.DIZZY_CLIENT_CONTINUITY_DELETION_LOG = testDeletionsFile;
process.env.DIZZY_EXECUTION_HISTORY_PATH = testExecHistory;
delete process.env.DIZZY_CHAT_BACKEND;

const { startServer } = await import("../agent_server.mjs");

const started = await startServer({
  port: 0,
  rateLimitEnabled: false,
  authTokenConfigured: false
});

try {
  // Test case 1: Ephemeral route receipt (should return receipt, but persisted is false)
  const ephemeralDiskBefore = snapshotDiskTree(DISPOSABLE_ROOT);
  const ephemeralRes = await fetch(`http://127.0.0.1:${started.boundPort}/agent/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      brief: "Test ephemeral routing receipt validation request.",
      continuity_mode: "ephemeral"
    })
  });
  assert.strictEqual(ephemeralRes.status, 200);
  const ephemeralData = await ephemeralRes.json();

  assert.ok(ephemeralData.router_receipt, "Response must contain router_receipt");
  const receipt1 = ephemeralData.router_receipt;
  assert.strictEqual(receipt1.schema_version, "dizzy.router_receipt.v1");
  assert.strictEqual(receipt1.chosen_model, "none:chat_backend_not_configured", "No-provider route must report no model execution");
  assert.strictEqual(receipt1.data_boundary, "none", "No-provider route must report no data boundary");
  assert.strictEqual(receipt1.model_origin_risk, "unknown", "No-provider route must report unknown model origin risk");
  assert.strictEqual(receipt1.estimated_cost_band, "free", "No-provider route must report free cost band");
  assert.strictEqual(receipt1.reason, "no_model_execution:chat_backend_not_configured", "No-provider route must explain no execution");
  assert.strictEqual(receipt1.fallback.blocked_reason, "chat_backend_not_configured", "No-provider fallback must carry explicit blocked reason");
  assert.strictEqual(receipt1.persisted, false, "Ephemeral request receipt must not be persisted");
  const ephemeralDiskAfter = snapshotDiskTree(DISPOSABLE_ROOT);
  assertNoDiskTreeDiff(ephemeralDiskBefore, ephemeralDiskAfter, "Ephemeral execution");

  // Test case 2: Client continuity route receipt (should return receipt, and persisted is true inside the conversation file)
  const clientRes = await fetch(`http://127.0.0.1:${started.boundPort}/agent/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      brief: "Test client-persisted routing receipt validation request.",
      continuity_mode: "client",
      client_id: "test_client_receipt",
      service_id: "test_service_receipt"
    })
  });
  assert.strictEqual(clientRes.status, 200);
  const clientData = await clientRes.json();

  assert.ok(clientData.router_receipt, "Response must contain router_receipt");
  const receipt2 = clientData.router_receipt;
  assert.strictEqual(receipt2.persisted, true, "Client continuity request receipt must be persisted");

  // Verify that the receipt is written directly inside the client conversation file (conversation_only retention path)
  const key = clientData.conversation_key;
  const convoFile = conversationPathForKey(key, testConvoDir);
  assert.ok(fs.existsSync(convoFile), "Conversation file must have been created");
  const convoLines = fs.readFileSync(convoFile, "utf8").trim().split("\n");
  const receiptRow = convoLines.map(JSON.parse).find(row => row.event === "router_receipt");
  assert.ok(receiptRow, "Conversation file must contain the router receipt event row");
  assert.strictEqual(receiptRow.payload.task_id, receipt2.task_id, "Persisted receipt task_id must match returned task_id");
  assert.strictEqual(receiptRow.payload.persisted, true, "Stored JSON record persisted property must be true");
  assert.deepStrictEqual(receiptRow.payload, receipt2, "Stored conversation receipt must match returned receipt");

  // Test case 2b: Global audit receipt persistence (verifies writing to the global audit file when retention is local_conversation)
  const auditRes = await fetch(`http://127.0.0.1:${started.boundPort}/dispatch/incoming`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text: "hello local routing receipt check",
      channel: "local"
    })
  });
  console.log(`[test] auditRes status=${auditRes.status}`);
  const auditData = await auditRes.json();
  console.log(`[test] auditData=`, JSON.stringify(auditData, null, 2));
  assert.ok(auditData.router_receipt, "Response must contain router_receipt");
  assert.strictEqual(auditData.router_receipt.persisted, true, "Audit receipt must be persisted");
  assert.ok(fs.existsSync(testReceiptsFile), "Global receipts audit file must have been created");
  const receiptLines = fs.readFileSync(testReceiptsFile, "utf8").trim().split("\n");
  const parsedAudit = JSON.parse(receiptLines[receiptLines.length - 1]);
  assert.strictEqual(parsedAudit.task_id, auditData.router_receipt.task_id, "Persisted audit receipt task ID must match response task ID");
  assert.strictEqual(parsedAudit.persisted, true, "Stored audit JSON record persisted property must be true");
  assert.strictEqual(auditData.router_receipt.chosen_model, "none:chat_backend_not_configured", "No-provider audit route must report no model execution");
  assert.strictEqual(auditData.router_receipt.data_boundary, "none", "No-provider audit route must report no data boundary");
  assert.strictEqual(auditData.router_receipt.model_origin_risk, "unknown", "No-provider audit route must report unknown model origin risk");
  assert.strictEqual(auditData.router_receipt.fallback.blocked_reason, "chat_backend_not_configured", "No-provider audit route must carry explicit blocked reason");
  assert.deepStrictEqual(parsedAudit, auditData.router_receipt, "Stored audit receipt must match returned receipt");

  // Test case 3: Decoupled local backend routing defaults (should route to Ollama defaults, bypassing compat env variables)
  const oldBackend = process.env.DIZZY_CHAT_BACKEND;
  const oldCompatUrl = process.env.OPENAI_COMPAT_BASE_URL;
  const oldCompatApiKey = process.env.OPENAI_COMPAT_API_KEY;
  const oldCompatModel = process.env.OPENAI_COMPAT_MODEL;

  const oldOllamaUrl = process.env.OLLAMA_BASE_URL;
  const oldOllamaModel = process.env.OLLAMA_MODEL;
  const oldAllowLan = process.env.DIZZY_ALLOW_LAN_LOCAL_BACKEND;

  process.env.DIZZY_CHAT_BACKEND = "local";
  process.env.OLLAMA_BASE_URL = mockOllamaUrl;
  delete process.env.OLLAMA_MODEL;
  delete process.env.DIZZY_ALLOW_LAN_LOCAL_BACKEND;

  // Set OpenAI compat parameters pointing to a simulated external endpoint to verify they are bypassed
  process.env.OPENAI_COMPAT_BASE_URL = "https://external-cloud-api-provider.com/v1";
  process.env.OPENAI_COMPAT_API_KEY = "external-api-bearer-token";
  process.env.OPENAI_COMPAT_MODEL = "external-giant-model";

  try {
    capturedMockRequest = null;
    const localRes = await fetch(`http://127.0.0.1:${started.boundPort}/agent/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        brief: "Test local backend mapping validation request.",
        continuity_mode: "ephemeral"
      })
    });
    assert.strictEqual(localRes.status, 200);
    const localData = await localRes.json();
    const receipt3 = localData.router_receipt;
    assert.strictEqual(receipt3.chosen_model, "openai_compat:gemma3:4b", "Local backend must default chosen model to gemma3:4b");
    assert.strictEqual(receipt3.estimated_cost_band, "low", "gemma3:4b must resolve to low cost band");
    assert.strictEqual(receipt3.data_boundary, "local_machine", "Local backend boundary must resolve to local_machine");
    assert.strictEqual(receipt3.model_origin_risk, "low", "Gemma-based local model origin risk must resolve to low");
    assert.strictEqual(localData.text, "Mock local assistant response", "Should successfully fetch response from mock local server");

    assert.ok(capturedMockRequest, "Mock provider must have captured request");
    assert.strictEqual(capturedMockRequest.url, "/v1/chat/completions");
    assert.strictEqual(capturedMockRequest.method, "POST");
    assert.strictEqual(capturedMockRequest.body.model, "gemma3:4b", "Captured mock payload model must match default Ollama model");
    assert.ok(Array.isArray(capturedMockRequest.body.messages), "Captured mock payload must include messages array");
    assert.strictEqual(capturedMockRequest.headers["authorization"], "Bearer local_nop", "Authorization header must be local_nop");
    assert.notStrictEqual(capturedMockRequest.headers["authorization"], "Bearer external-api-bearer-token", "External API bearer token must not leak to local mock provider");

    // Test case 3b: Local backend with Qwen model (should flag high origin risk)
    process.env.OLLAMA_MODEL = "qwen2.5-coder:7b";
    const qwenRes = await fetch(`http://127.0.0.1:${started.boundPort}/agent/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        brief: "Test local Qwen model routing risk validation request.",
        continuity_mode: "ephemeral"
      })
    });
    assert.strictEqual(qwenRes.status, 200);
    const qwenData = await qwenRes.json();
    const receipt3b = qwenData.router_receipt;
    assert.strictEqual(receipt3b.chosen_model, "openai_compat:qwen2.5-coder:7b", "Chosen model must match set local Qwen model");
    assert.strictEqual(receipt3b.model_origin_risk, "high", "Qwen model origin risk must resolve to high");
    assert.strictEqual(receipt3b.estimated_cost_band, "low", "7b model must resolve to low cost band");

    // Test case 3c: Security exception validation (setting base URL to a non-loopback host should throw a security exception)
    process.env.OLLAMA_BASE_URL = "https://external-cloud-api-provider.com/v1";
    const secureExcRes = await fetch(`http://127.0.0.1:${started.boundPort}/agent/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        brief: "Test secure host loopback constraint.",
        continuity_mode: "ephemeral"
      })
    });
    assert.strictEqual(secureExcRes.status, 200);
    const secureExcData = await secureExcRes.json();
    assert.match(secureExcData.text, /Security Exception: DIZZY_CHAT_BACKEND=local resolved base URL host.*is not a loopback address/, "Should throw host validation error");
    assert.strictEqual(secureExcData.router_receipt.fallback.blocked_reason, "security_exception_non_loopback", "Receipt should log loopback blockade reason");

    // Test case 3d: LAN override must not permit arbitrary WAN leakage
    process.env.DIZZY_ALLOW_LAN_LOCAL_BACKEND = "1";
    const wanOverrideRes = await fetch(`http://127.0.0.1:${started.boundPort}/agent/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        brief: "Test LAN override WAN blockade.",
        continuity_mode: "ephemeral"
      })
    });
    assert.strictEqual(wanOverrideRes.status, 200);
    const wanOverrideData = await wanOverrideRes.json();
    assert.match(wanOverrideData.text, /not loopback or a literal private LAN IP/, "WAN host must remain blocked even when LAN override is enabled");
    assert.strictEqual(wanOverrideData.router_receipt.fallback.blocked_reason, "security_exception_non_private_lan", "Receipt should log private LAN override blockade reason");
  } finally {
    // Restore environment
    if (oldBackend !== undefined) process.env.DIZZY_CHAT_BACKEND = oldBackend;
    else delete process.env.DIZZY_CHAT_BACKEND;
    if (oldCompatUrl !== undefined) process.env.OPENAI_COMPAT_BASE_URL = oldCompatUrl;
    else delete process.env.OPENAI_COMPAT_BASE_URL;
    if (oldCompatApiKey !== undefined) process.env.OPENAI_COMPAT_API_KEY = oldCompatApiKey;
    else delete process.env.OPENAI_COMPAT_API_KEY;
    if (oldCompatModel !== undefined) process.env.OPENAI_COMPAT_MODEL = oldCompatModel;
    else delete process.env.OPENAI_COMPAT_MODEL;
    if (oldOllamaUrl !== undefined) process.env.OLLAMA_BASE_URL = oldOllamaUrl;
    else delete process.env.OLLAMA_BASE_URL;
    if (oldOllamaModel !== undefined) process.env.OLLAMA_MODEL = oldOllamaModel;
    else delete process.env.OLLAMA_MODEL;
    if (oldAllowLan !== undefined) process.env.DIZZY_ALLOW_LAN_LOCAL_BACKEND = oldAllowLan;
    else delete process.env.DIZZY_ALLOW_LAN_LOCAL_BACKEND;
  }
} finally {
  await started.stop();
  await new Promise((resolve) => mockProvider.close(resolve));

  // Cleanup environment variables overrides
  delete process.env.DIZZY_ROUTER_RECEIPT_PATH;
  delete process.env.DIZZY_CONVERSATION_DIR;
  delete process.env.DIZZY_CLIENT_CONTINUITY_DELETION_LOG;
  delete process.env.DIZZY_EXECUTION_HISTORY_PATH;
  if (oldRouterBackend !== undefined) process.env.DIZZY_CHAT_BACKEND = oldRouterBackend;
  else delete process.env.DIZZY_CHAT_BACKEND;
}

// Clean up isolated root
fs.rmSync(DISPOSABLE_ROOT, { recursive: true, force: true });
console.log("\nALL INTEGRATION TESTS PASSED SUCCESSFULLY!");
