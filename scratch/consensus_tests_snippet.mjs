import assert from "assert";
import fs from "fs";
import path from "path";

async function testConsensusStateTransitions() {
  const { getConsensusState, signOffOperator, vetoOperator, initializeNewProposal } = await import("../lib/consensus.mjs");
  const statePath = path.resolve(process.cwd(), "runtime", "consensus_state.json");
  const bannedConsensusPhrases = [
    "SIGNED",
    "Consensus Reached",
    "Multi-Agent Validator Signing Chain",
    "Veto Override",
    "Reverting state commit",
    "tension metrics",
  ];
  const assertNoBannedPhrases = (label, value) => {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    for (const phrase of bannedConsensusPhrases) {
      assert.equal(serialized.includes(phrase), false, `${label} must not contain ${phrase}`);
    }
  };

  fs.rmSync(statePath, { force: true });
  fs.rmSync(`${statePath}.lock`, { force: true });

  const defaultState = getConsensusState();
  assert.equal(defaultState.consensus_status, "Awaiting Operator");
  assert.equal(defaultState.basis, "operator_reported_review_state");
  assert.equal(defaultState.proof_limit, "not_cryptographic_not_live_multi_agent_protocol");
  assert.equal(defaultState.operator_decision, "AWAITING_OPERATOR");
  assert.equal(defaultState.reported_review_state.antigravity, "AWAITING_OPERATOR_REVIEW");
  assert.equal(defaultState.reported_review_state.codex, "REPORTED_REVIEWED");
  assert.equal(defaultState.reported_review_state.openclaude, "REPORTED_REVIEWED");
  assert.deepEqual(defaultState.signing_chain, defaultState.reported_review_state);
  assert.match(defaultState.signing_chain_deprecated_note, /Deprecated compatibility alias/);
  assertNoBannedPhrases("default consensus state", defaultState);

  const signoffRes = signOffOperator();
  assert.equal(signoffRes.consensus_status, "Operator Accepted Reported Reviews");
  assert.equal(signoffRes.operator_decision, "ACCEPTED_REPORTED_STATE");
  assert.equal(signoffRes.reported_review_state.antigravity, "REPORTED_REVIEWED");
  assert.equal(signoffRes.basis, "operator_reported_review_state");
  assert.equal(signoffRes.proof_limit, "not_cryptographic_not_live_multi_agent_protocol");
  assertNoBannedPhrases("operator accept response", signoffRes);

  const persistedState = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.equal(persistedState.consensus_status, "Operator Accepted Reported Reviews");
  assert.equal(persistedState.reported_review_state.antigravity, "REPORTED_REVIEWED");

  const vetoRes = vetoOperator();
  assert.equal(vetoRes.consensus_status, "Rejected by Operator");
  assert.equal(vetoRes.operator_decision, "REJECTED_REPORTED_STATE");
  assert.equal(vetoRes.reported_review_state.codex, "REPORTED_REVIEWED");
  assert.equal(vetoRes.reported_review_state.openclaude, "REPORTED_REVIEWED");
  assert.equal(vetoRes.reported_review_state.antigravity, "REPORTED_REVIEWED");
  assert.equal(vetoRes.basis, "operator_reported_review_state");
  assert.equal(vetoRes.proof_limit, "not_cryptographic_not_live_multi_agent_protocol");
  assert.doesNotMatch(vetoRes.message, /rollback|revert/i);
  assertNoBannedPhrases("operator rejection response", vetoRes);

  const persistedVeto = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.equal(persistedVeto.consensus_status, "Rejected by Operator");
  assert.equal(persistedVeto.operator_decision, "REJECTED_REPORTED_STATE");
  assert.equal(persistedVeto.reported_review_state.codex, "REPORTED_REVIEWED");

  const newProposal = initializeNewProposal();
  assert.equal(newProposal.consensus_status, "Awaiting Operator");
  assert.equal(newProposal.operator_decision, "AWAITING_OPERATOR");
  assert.equal(newProposal.reported_review_state.antigravity, "AWAITING_OPERATOR_REVIEW");
  assertNoBannedPhrases("new proposal state", newProposal);

  const dashboardHtml = fs.readFileSync(path.resolve(process.cwd(), "dashboard", "index.html"), "utf8");
  const dashboardJs = fs.readFileSync(path.resolve(process.cwd(), "dashboard", "dashboard.js"), "utf8");
  assertNoBannedPhrases("dashboard html", dashboardHtml);
  assertNoBannedPhrases("dashboard js", dashboardJs);

  fs.rmSync(statePath, { force: true });
  fs.rmSync(`${statePath}.lock`, { force: true });
  console.log("-> Consensus state transitions checks passed");
}
