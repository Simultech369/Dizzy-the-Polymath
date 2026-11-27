/**
 * Cross-Repository Contract Test: Dizzy <-> CouncilEngine Shared Approval States & Task Router.
 *
 * Verifies:
 * 1. Exact state-machine equivalence (`running`, `waiting_for_approval`, `approved`, `rejected`, `resumed`, `cancelled`)
 *    and identical transition edges across Node (`lib/workflow_state_machines.mjs`) and Python (`human_approval.py`).
 * 2. Live cross-runtime roundtrip: Node submits verification job to CouncilEngine `CouncilAPIServer`,
 *    inspects `waiting_for_approval` + promotion blockers, rejects illegal jumps, resolves `approved`/`rejected`,
 *    consumes `resume_token` -> `resumed`, and verifies the hash-chained audit trail.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  HUMAN_APPROVAL_STATES,
  HUMAN_APPROVAL_TRANSITIONS,
  IllegalWorkflowTransitionError,
} from "../lib/workflow_state_machines.mjs";
import { HitlApprovalGateway } from "../lib/hitl_approval_gateway.mjs";

console.log("=== Dizzy <-> CouncilEngine Shared Approval & Verification Contract Suite ===");

const councilDirCandidates = [
  process.env.COUNCIL_ENGINE_DIR,
  path.resolve(process.cwd(), "../CouncilEngine"),
  path.resolve(process.cwd(), "tools/council"),
].filter(Boolean);

const councilDir = councilDirCandidates.find((dir) =>
  fs.existsSync(path.join(dir, "human_approval.py")) && fs.existsSync(path.join(dir, "council_api_server.py"))
);

// Always verify the canonical Dizzy side first
const tempNodeDir = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy-contract-node-"));
try {
  const gw = new HitlApprovalGateway({ ledgerDir: tempNodeDir, secret: "contract-secret-32b-shared-key!!" });
  const run = gw.startRun({ runId: "contract_run_1", actionType: "council_promotion" });
  assert.equal(run.workflow_state, "running");
  const req = gw.requestApproval("contract_run_1");
  assert.equal(req.checkpoint.workflow_state, "waiting_for_approval");
  assert.throws(
    () => gw.resumeCheckpoint({ resumeToken: req.resume_token, runId: "contract_run_1" }),
    (err) => err instanceof IllegalWorkflowTransitionError && err.code === "ILLEGAL_STATE_TRANSITION"
  );
  const app = gw.resolveCheckpoint({ resumeToken: req.resume_token, action: "APPROVE", approverId: "operator_1" });
  assert.equal(app.workflow_state, "approved");
  const res = gw.resumeCheckpoint({ resumeToken: req.resume_token, runId: "contract_run_1" });
  assert.equal(res.workflow_state, "resumed");
} finally {
  fs.rmSync(tempNodeDir, { recursive: true, force: true });
}

if (!councilDir) {
  console.log("[SKIP CROSS-REPO PYTHON PROBE] Sibling CouncilEngine checkout not present; local Dizzy state contract verified.");
  console.log("DIZZY_COUNCIL_APPROVAL_CONTRACT_OK");
  process.exit(0);
}

const pythonBin = process.platform === "win32" ? "python" : "python3";
const pythonProbe = `
import json, sys
sys.path.insert(0, ${JSON.stringify(councilDir)})
from human_approval import HUMAN_APPROVAL_STATES, HUMAN_APPROVAL_TRANSITIONS, IllegalApprovalTransitionError
from council_api_server import CouncilAPIServer

api = CouncilAPIServer()
job = api.handle_submit_verification_job({
    "objective": "Deploy verified A2A contract upgrade",
    "candidate_files": ["a2a_protocol_engine.py"],
    "require_promotion_approval": True,
})

illegal_blocked = False
try:
    api.handle_resume_approval({"resume_token": job["resume_token"]})
except IllegalApprovalTransitionError as exc:
    illegal_blocked = (exc.code == "ILLEGAL_STATE_TRANSITION")

approved = api.handle_resolve_approval({
    "resume_token": job["resume_token"],
    "decision": "approve",
    "approver_identity": "operator_contract",
    "reason": "Cross-repo contract verification",
})
resumed = api.handle_resume_approval({"resume_token": job["resume_token"]})

rej_req = api.handle_request_approval({
    "subject_type": "AUTHORITY_UPGRADE",
    "subject_payload_sha256": "f" * 64,
})
rejected = api.handle_resolve_approval({
    "resume_token": rej_req["resume_token"],
    "decision": "reject",
    "approver_identity": "operator_contract",
    "reason": "Blocked unverified promotion",
})
audit = api.handle_approval_audit_log()

print(json.dumps({
    "states": list(HUMAN_APPROVAL_STATES),
    "transitions": {k: list(v) for k, v in HUMAN_APPROVAL_TRANSITIONS.items()},
    "job_initial_status": job["status"],
    "job_blockers": job["promotion_blockers"],
    "illegal_blocked": illegal_blocked,
    "approved_state": approved["workflow_state"],
    "resumed_state": resumed["workflow_state"],
    "rejected_state": rejected["workflow_state"],
    "audit_valid": audit["valid"],
}))
`;

const rawOut = execFileSync(pythonBin, ["-c", pythonProbe], { encoding: "utf8" });
const pyResult = JSON.parse(rawOut.trim());

const nodeStates = Object.values(HUMAN_APPROVAL_STATES);
assert.deepEqual(pyResult.states, nodeStates, "Node and Python approval states must match 1:1");

for (const state of nodeStates) {
  assert.deepEqual(
    pyResult.transitions[state],
    [...(HUMAN_APPROVAL_TRANSITIONS[state] || [])],
    `Transition mismatch for state '${state}' between Dizzy and CouncilEngine`
  );
}

assert.equal(pyResult.job_initial_status, "waiting_for_approval");
assert.ok(pyResult.job_blockers.includes("human_approval_pending"));
assert.equal(pyResult.illegal_blocked, true);
assert.equal(pyResult.approved_state, "approved");
assert.equal(pyResult.resumed_state, "resumed");
assert.equal(pyResult.rejected_state, "rejected");
assert.equal(pyResult.audit_valid, true);

console.log("  [PASS] Node (Dizzy) and Python (CouncilEngine) share identical approval states, transitions, and blockers.");
console.log("DIZZY_COUNCIL_APPROVAL_CONTRACT_OK");
