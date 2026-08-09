import assert from "node:assert/strict";
import {
  BACKEND_CONNECTION_RCA_AUTHORITY,
  BACKEND_CONNECTION_RCA_SCHEMA,
  classifyConnectionFailure,
} from "../lib/backend_connection_rca.mjs";

console.log("=== W-0068 Backend Connection RCA Test Suite ===");

const missing = classifyConnectionFailure({
  backend: "openai_compat",
  baseUrl: "",
  model: "qwen/qwen3-32b",
  now: new Date("2026-08-09T00:00:00.000Z"),
});
assert.equal(missing.schema_version, BACKEND_CONNECTION_RCA_SCHEMA);
assert.equal(missing.authority, BACKEND_CONNECTION_RCA_AUTHORITY);
assert.equal(missing.likely_root_cause, "missing_base_url");
assert.equal(missing.base_url_host, "");
assert.match(missing.next_actions.join(" "), /base URL/i);

const cloudBlocked = classifyConnectionFailure({
  backend: "openai_compat",
  baseUrl: "https://openrouter.ai/api/v1",
  model: "openrouter/auto",
  allowCloud: false,
  trustZone: "private_self",
});
assert.equal(cloudBlocked.likely_root_cause, "cloud_blocked_by_policy");
assert.equal(cloudBlocked.base_url_host, "openrouter.ai");
assert.match(cloudBlocked.next_actions.join(" "), /Simul explicitly approves cloud execution/);

const localUnreachable = classifyConnectionFailure({
  backend: "ollama",
  baseUrl: "http://127.0.0.1:11434/v1",
  model: "gemma3:4b",
  error: "fetch failed token=secret_should_not_survive",
  isLocalIsolationRequired: true,
  probes: {
    tcpReachable: false,
    httpReachable: false,
    tcpError: "connect ECONNREFUSED 127.0.0.1:11434",
  },
});
assert.equal(localUnreachable.likely_root_cause, "local_backend_unreachable");
assert.equal(localUnreachable.host_classification.is_loopback, true);
assert.doesNotMatch(JSON.stringify(localUnreachable), /secret_should_not_survive/);

const permissionDenied = classifyConnectionFailure({
  backend: "ollama",
  baseUrl: "http://127.0.0.1:11434/v1",
  model: "gemma3:4b",
  error: "Error: timed out waiting for server to start",
  isLocalIsolationRequired: true,
  probes: {
    tcpReachable: false,
    httpReachable: false,
    logEvidence: "ollama app.log failed to create server log open C:\\Users\\Josh\\AppData\\Local\\Ollama\\app.log: Access is denied.",
  },
});
assert.equal(permissionDenied.likely_root_cause, "ollama_log_permission_denied");
assert.match(permissionDenied.evidence.join(" "), /Access is denied/);
assert.match(permissionDenied.next_actions.join(" "), /log directory permissions/);

const authFailure = classifyConnectionFailure({
  backend: "openai_compat",
  baseUrl: "https://api.example.com/v1",
  model: "example-model",
  allowCloud: true,
  error: "HTTP 401 invalid api_key=secret_should_not_survive",
});
assert.equal(authFailure.likely_root_cause, "auth_missing_or_invalid");
assert.doesNotMatch(JSON.stringify(authFailure), /secret_should_not_survive/);

console.log("BACKEND_CONNECTION_RCA_TESTS_OK");
