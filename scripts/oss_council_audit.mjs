import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

/**
 * OSS Model Council Audit Harness
 * Implements a 3-layer verification engine:
 * 1. Syntax & Static Integrity Check (Synthesizer Layer)
 * 2. Adversarial Governance & Trust Zone Audit (Adversary Layer)
 * 3. Hard Deterministic Subprocess Execution (Execution Gate Layer)
 */

function logStep(msg) {
  console.log(`\x1b[36m[OSS Council Audit]\x1b[0m ${msg}`);
}

function logSuccess(msg) {
  console.log(`\x1b[32m[PASS]\x1b[0m ${msg}`);
}

function logFailure(msg) {
  console.error(`\x1b[31m[FAIL]\x1b[0m ${msg}`);
}

async function runAudit() {
  console.log("==================================================");
  console.log("   Dizzy OSS Model Council Verification Engine    ");
  console.log("==================================================\n");

  const results = {
    timestamp: new Date().toISOString(),
    layers: {
      syntax: { status: "PENDING", details: [] },
      governance: { status: "PENDING", details: [] },
      execution: { status: "PENDING", details: [] },
    },
    verdict: "REJECTED",
  };

  // --- Layer 1: Syntax & Static Integrity ---
  logStep("Layer 1: Auditing JS/MJS syntax integrity (Synthesizer Layer)...");
  const targetFiles = [
    "agent_server.mjs",
    "lib/anti_slop_scanner.mjs",
    "lib/backend_connection_rca.mjs",
    "lib/bridging_memory_scanner.mjs",
    "lib/dispatch.mjs",
    "lib/friction_anomaly_detector.mjs",
    "lib/ingress_gateway.mjs",
    "lib/model_registry.mjs",
    "lib/model_router.mjs",
    "lib/openai_compat_client.mjs",
    "lib/provider_capability_matrix.mjs",
    "lib/rehearsal_gate.mjs",
    "lib/scenario_simulator.mjs",
    "lib/self_monitoring_calibration.mjs",
    "lib/trace_chain.mjs",
    "lib/review_cycle_coverage.mjs",
    "lib/review_cycle_orchestrator.mjs",
    "lib/review_cycle_runner.mjs",
    "lib/review_loop_supervisor.mjs",
    "lib/review_model_runner.mjs",
    "lib/review_synthesis.mjs",
    "lib/sqlite_operational_store.mjs",
    "lib/trajectory_snapshot_store.mjs",
    "scripts/ai_sre_diagnose.mjs",
    "scripts/ai_sre_diagnose_test.mjs",
    "scripts/anti_slop_prose_fixture_check.mjs",
    "scripts/frontier_simulation_test.mjs",
    "scripts/rehearsal_gate_test.mjs",
    "scripts/self_monitoring_calibration_test.mjs",
    "scripts/trace_chain_test.mjs",
    "scripts/local_chaos_harness_test.mjs",
    "scripts/context_hygiene_audit.mjs",
    "scripts/backend_connection_rca.mjs",
    "scripts/backend_connection_rca_test.mjs",
    "scripts/context_tree_check.mjs",
    "scripts/dashboard_safety_harness_test.mjs",
    "scripts/dynamic_router_test.mjs",
    "scripts/eval_gate_policy_check.mjs",
    "scripts/eval_gate_policy_check_test.mjs",
    "scripts/ingress_gateway_test.mjs",
    "scripts/model_registry_test.mjs",
    "scripts/model_router_test.mjs",
    "scripts/ollama_availability_check.mjs",
    "scripts/openrouter_free_slug_probe.mjs",
    "scripts/provider_capability_matrix_test.mjs",
    "scripts/replay_safety_test.mjs",
    "scripts/review_cycle_coverage.mjs",
    "scripts/review_cycle_coverage_test.mjs",
    "scripts/review_cycle_orchestrator_test.mjs",
    "scripts/review_cycle_plan.mjs",
    "scripts/review_cycle_run.mjs",
    "scripts/review_cycle_run_test.mjs",
    "scripts/review_loop_supervisor.mjs",
    "scripts/review_loop_supervisor_test.mjs",
    "scripts/review_model_batch.mjs",
    "scripts/review_model_runner_test.mjs",
    "scripts/review_synthesis.mjs",
    "scripts/review_synthesis_test.mjs",
    "scripts/trajectory_snapshot_store_test.mjs",
    "scripts/test_active_integration.mjs",
  ];

  let syntaxFailed = false;
  for (const relPath of targetFiles) {
    const absPath = path.join(ROOT_DIR, relPath);
    if (!fs.existsSync(absPath)) {
      results.layers.syntax.details.push(`File missing: ${relPath}`);
      syntaxFailed = true;
      continue;
    }
    const check = spawnSync(process.execPath, ["--check", absPath], { encoding: "utf8" });
    if (check.status !== 0) {
      logFailure(`Syntax error in ${relPath}: ${check.stderr}`);
      results.layers.syntax.details.push(`Syntax error in ${relPath}`);
      syntaxFailed = true;
    } else {
      results.layers.syntax.details.push(`OK: ${relPath}`);
    }
  }

  if (syntaxFailed) {
    results.layers.syntax.status = "FAILED";
    logFailure("Layer 1 check failed. Aborting council audit.");
    saveReceipt(results);
    process.exit(1);
  }
  results.layers.syntax.status = "PASSED";
  logSuccess("Layer 1: All target files passed syntax checks.");

  // --- Layer 2: Governance & Trust Zone Audit ---
  logStep("\nLayer 2: Checking governance rules & trust-zone isolation (Adversary Layer)...");
  let govFailed = false;

  // Check 1: No bare chosen_model "none" without error suffix in lib/dispatch.mjs
  const dispatchCode = fs.readFileSync(path.join(ROOT_DIR, "lib/dispatch.mjs"), "utf8");
  if (dispatchCode.includes('chosen_model: "none"') || dispatchCode.includes("chosen_model: 'none'")) {
    logFailure("Governance Breach: Bare chosen_model 'none' detected in lib/dispatch.mjs");
    results.layers.governance.details.push("Bare chosen_model 'none' detected in lib/dispatch.mjs");
    govFailed = true;
  } else {
    results.layers.governance.details.push("Pass: No bare chosen_model 'none'");
  }

  // Check 2: Redirects in openai_compat_client.mjs must be manual
  const clientCode = fs.readFileSync(path.join(ROOT_DIR, "lib/openai_compat_client.mjs"), "utf8");
  if (!clientCode.includes('redirect: "manual"')) {
    logFailure("Governance Breach: openai_compat_client.mjs does not enforce manual redirect mode.");
    results.layers.governance.details.push("Missing redirect: 'manual' enforcement");
    govFailed = true;
  } else {
    results.layers.governance.details.push("Pass: Manual redirect mode enforced");
  }

  if (govFailed) {
    results.layers.governance.status = "FAILED";
    logFailure("Layer 2 check failed. Aborting council audit.");
    saveReceipt(results);
    process.exit(1);
  }
  results.layers.governance.status = "PASSED";
  logSuccess("Layer 2: Governance and isolation policies verified.");

  // --- Layer 3: Hard Deterministic Subprocess Execution ---
  logStep("\nLayer 3: Running hard subprocess verification suites (Execution Gate)...");
  const testSuites = [
    { name: "Router Integration Suite", script: "scripts/dynamic_router_test.mjs" },
    { name: "Model Router Suite", script: "scripts/model_router_test.mjs" },
    { name: "Ingress Gateway Suite", script: "scripts/ingress_gateway_test.mjs" },
    { name: "Replay Safety Suite", script: "scripts/replay_safety_test.mjs" },
    { name: "Trajectory Snapshot Suite", script: "scripts/trajectory_snapshot_store_test.mjs" },
    { name: "Model Registry Suite", script: "scripts/model_registry_test.mjs" },
    { name: "Review Cycle Coverage Suite", script: "scripts/review_cycle_coverage_test.mjs" },
    { name: "Review Cycle Orchestrator Suite", script: "scripts/review_cycle_orchestrator_test.mjs" },
    { name: "Review Cycle Run Suite", script: "scripts/review_cycle_run_test.mjs" },
    { name: "Review Loop Supervisor Suite", script: "scripts/review_loop_supervisor_test.mjs" },
    { name: "Model Review Runner Suite", script: "scripts/review_model_runner_test.mjs" },
    { name: "Review Synthesis Suite", script: "scripts/review_synthesis_test.mjs" },
    { name: "AI SRE Diagnose Suite", script: "scripts/ai_sre_diagnose_test.mjs" },
    { name: "Rehearsal Gate Suite", script: "scripts/rehearsal_gate_test.mjs" },
    { name: "Request Trace Chain Suite", script: "scripts/trace_chain_test.mjs" },
    { name: "Local Chaos Harness Suite", script: "scripts/local_chaos_harness_test.mjs" },
    { name: "Frontier Simulation & Friction Suite", script: "scripts/frontier_simulation_test.mjs" },
    { name: "Anti-Slop Prose Fixture Suite", script: "scripts/anti_slop_prose_fixture_check.mjs" },
    { name: "Self-Monitoring Calibration Suite", script: "scripts/self_monitoring_calibration_test.mjs" },
    { name: "Context Hygiene Audit Suite", script: "scripts/context_hygiene_audit.mjs" },
    { name: "Backend Connection RCA Suite", script: "scripts/backend_connection_rca_test.mjs" },
    { name: "Provider Capability Matrix Suite", script: "scripts/provider_capability_matrix_test.mjs" },
    { name: "Eval Gate Policy Unit Suite", script: "scripts/eval_gate_policy_check_test.mjs" },
    { name: "Eval Gate Promotion Policy", script: "scripts/eval_gate_policy_check.mjs" },
    { name: "Context Tree Check Suite", script: "scripts/context_tree_check.mjs" },
    { name: "Dashboard Safety Harness Suite", script: "scripts/dashboard_safety_harness_test.mjs" },
    { name: "Risk Scaler Suite", script: "scripts/risk_scaler_test.mjs" },
    { name: "Golden Retrieval Eval Suite", script: "scripts/retrieval_eval.mjs" },
    { name: "Safety Checks Suite", script: "scripts/safety_checks.mjs" },
  ];

  let execFailed = false;
  for (const suite of testSuites) {
    logStep(`Running ${suite.name} (${suite.script})...`);
    const run = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(ROOT_DIR, suite.script)], {
      encoding: "utf8",
      cwd: ROOT_DIR,
    });
    if (run.status !== 0) {
      logFailure(`Suite ${suite.name} failed with exit code ${run.status}`);
      results.layers.execution.details.push(`FAILED: ${suite.name} (Code ${run.status})`);
      execFailed = true;
    } else {
      logSuccess(`Suite ${suite.name} passed cleanly.`);
      results.layers.execution.details.push(`PASSED: ${suite.name}`);
    }
  }

  if (execFailed) {
    results.layers.execution.status = "FAILED";
    logFailure("Layer 3 execution failed.");
    saveReceipt(results);
    process.exit(1);
  }
  results.layers.execution.status = "PASSED";
  logSuccess("Layer 3: All deterministic test suites passed!");

  // --- Final Verdict ---
  results.verdict = "VERIFIED_PASSED";
  console.log("\n==================================================");
  console.log("   COUNCIL VERDICT: VERIFIED_PASSED (READY FOR STAGING) ");
  console.log("==================================================\n");

  saveReceipt(results);
}

function saveReceipt(results) {
  const reviewsDir = path.join(ROOT_DIR, "reviews");
  if (!fs.existsSync(reviewsDir)) {
    fs.mkdirSync(reviewsDir, { recursive: true });
  }
  const receiptPath = path.join(reviewsDir, "oss_council_verdict_latest.json");
  fs.writeFileSync(receiptPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`Saved audit receipt to: ${receiptPath}`);
}

runAudit();
