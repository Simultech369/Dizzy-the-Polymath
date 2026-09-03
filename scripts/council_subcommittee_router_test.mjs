import assert from "node:assert/strict";
import {
  buildSubcommitteeRotationSchedule,
  evaluateSubcommitteeFindings,
  packetizeSubcommitteeVerdict,
  SUBCOMMITTEE_VERDICT_SCHEMA,
  SUBCOMMITTEE_ROLES,
} from "../lib/council_subcommittee_router.mjs";
import { A2A_MESSAGE_SCHEMA } from "../lib/a2a_mailbox_bridge.mjs";

console.log("[test:council-subcommittee-router] Starting test suite...");

// Test 1: Subcommittee rotation shifts model assignments across cycles
{
  const models = ["model-A", "model-B", "model-C", "model-D", "model-E", "model-F"];
  const cycle0 = buildSubcommitteeRotationSchedule({ cycleIndex: 0, availableModels: models });
  const cycle1 = buildSubcommitteeRotationSchedule({ cycleIndex: 1, availableModels: models });

  assert.equal(cycle0.cycle_index, 0);
  assert.equal(cycle0.assignments.synthesizer, "model-A");
  assert.equal(cycle0.assignments.adversary, "model-B");

  assert.equal(cycle1.cycle_index, 1);
  assert.equal(cycle1.assignments.synthesizer, "model-B");
  assert.equal(cycle1.assignments.adversary, "model-C");
  assert.notEqual(cycle0.schedule_hash, cycle1.schedule_hash);
  console.log("  [PASS] Test 1: Subcommittee rotation schedule generation");
}

// Test 2: Evaluate unanimous passing findings
{
  const findings = SUBCOMMITTEE_ROLES.map((role) => ({
    role,
    model: `model-${role}`,
    verdict: "PASS",
    dialectical_position: {
      elegance_vs_durability: 0.2,
      speed_vs_rigor: -0.1,
      sovereignty_vs_cloud: 0.8,
      conservative_vs_frontier: 0.4,
    },
  }));

  const verdict = evaluateSubcommitteeFindings({
    topicId: "topic_unanimous_01",
    findings,
    quorumThreshold: 0.66,
  });

  assert.equal(verdict.schema_version, SUBCOMMITTEE_VERDICT_SCHEMA);
  assert.equal(verdict.overall_verdict, "COUNCIL_PASSED");
  assert.equal(verdict.quorum_met, true);
  assert.equal(verdict.pass_votes, 6);
  assert.equal(verdict.fail_votes, 0);
  assert.ok(verdict.tension_metrics);
  assert.ok(verdict.verdict_hash && verdict.verdict_hash.length === 64);
  console.log("  [PASS] Test 2: Unanimous passing evaluation");
}

// Test 3: Evaluate minority dissent and dialectical tension
{
  const findings = [
    {
      role: "synthesizer",
      model: "deepseek-reasoner",
      verdict: "PASS",
      dialectical_position: {
        elegance_vs_durability: -0.8,
        speed_vs_rigor: -0.9,
        sovereignty_vs_cloud: 0.9,
        conservative_vs_frontier: -0.5,
      },
    },
    {
      role: "adversary",
      model: "qwen-coder",
      verdict: "FAIL",
      reason: "Potential edge condition in boundary parsing",
      severity: "LOW",
      dialectical_position: {
        elegance_vs_durability: 0.7,
        speed_vs_rigor: 0.8,
        sovereignty_vs_cloud: -0.3,
        conservative_vs_frontier: 0.6,
      },
    },
    {
      role: "formal_verifier",
      model: "gemma-27b",
      verdict: "PASS",
      dialectical_position: {
        elegance_vs_durability: -0.2,
        speed_vs_rigor: -0.5,
        sovereignty_vs_cloud: 0.7,
        conservative_vs_frontier: 0.1,
      },
    },
  ];

  const verdict = evaluateSubcommitteeFindings({
    topicId: "topic_minority_dissent",
    findings,
    quorumThreshold: 0.60,
  });

  assert.equal(verdict.overall_verdict, "COUNCIL_PASSED");
  assert.equal(verdict.pass_votes, 2);
  assert.equal(verdict.fail_votes, 1);
  assert.equal(verdict.domain_alerts.length, 1);
  assert.ok(verdict.tension_metrics.tension_variance > 0);
  console.log("  [PASS] Test 3: Minority dissent preservation & tension mapping");
}

// Test 4: Packetize verdict into A2A envelope
{
  const findings = [
    { role: "synthesizer", model: "model-A", verdict: "PASS" },
    { role: "security_auditor", model: "model-B", verdict: "PASS" },
  ];

  const verdict = evaluateSubcommitteeFindings({
    topicId: "topic_a2a_01",
    findings,
  });

  const packet = packetizeSubcommitteeVerdict({
    verdict,
    senderId: "oss_council",
    recipientId: "codex",
  });

  assert.equal(packet.schema_version, A2A_MESSAGE_SCHEMA);
  assert.equal(packet.sender_id, "oss_council");
  assert.equal(packet.recipient_id, "codex");
  assert.equal(packet.message_type, "council_critique");
  assert.equal(packet.payload.overall_verdict, "COUNCIL_PASSED");
  console.log("  [PASS] Test 4: Packetize verdict into A2A envelope");
}

console.log("\n[test:council-subcommittee-router] ALL TESTS PASSED CLEANLY.\n");
