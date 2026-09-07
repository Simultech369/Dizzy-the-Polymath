export const COUNCIL_BRIDGE_STATUS_SCHEMA = "dizzy.council_bridge_status.v1";

export function buildCouncilBridgeStatus({
  mailboxStats = {},
  a2aAuthConfigured = false,
  now = () => new Date(),
} = {}) {
  const stats = mailboxStats && typeof mailboxStats === "object" ? mailboxStats : {};
  const registeredTrustKeys = Number(stats.registered_trust_keys || 0);
  const requireSignature = Boolean(stats.require_signature);

  return {
    schema_version: COUNCIL_BRIDGE_STATUS_SCHEMA,
    timestamp: now().toISOString(),
    status: "LOCAL_REHEARSAL_COMPONENTS_VISIBLE",
    bridge_mode: "local_rehearsal",
    integration_state: "component_status_only",
    receipt_authority: "advisory_receipt",
    runtime_promotion_allowed: false,
    public_claim_allowed: false,
    auth_boundary: "operator_token_or_dashboard_session_required",
    hmi_answer: "Dizzy exposes authenticated operator visibility into local Council bridge components. This does not prove a continuous mailbox-to-sidecar worker, a public turnkey bridge, or production sidecar authority.",
    a2a_ingress: {
      route: "/api/a2a/incoming",
      auth_configured: Boolean(a2aAuthConfigured),
      route_posture: a2aAuthConfigured ? "configured_for_signed_ingress" : "fail_closed_until_a2a_secret_or_trust_store",
    },
    component_map: [
      {
        step: "signed_a2a_ingress",
        route: "/api/a2a/incoming",
        evidence: "lib/a2a_boundary_guard.mjs",
        status: "implemented",
      },
      {
        step: "mailbox_queue",
        route: "/api/a2a/mailbox/stats",
        evidence: "lib/a2a_mailbox_bridge.mjs",
        status: "implemented",
      },
      {
        step: "leased_dispatch",
        route: "/api/a2a/mailbox/dequeue",
        evidence: "dizzy.a2a_dispatch_receipt.v1",
        status: "implemented",
      },
      {
        step: "explicit_ack",
        route: "/api/a2a/mailbox/ack",
        evidence: "dizzy.a2a_mailbox_receipt.v1",
        status: "implemented",
      },
      {
        step: "node_python_bridge_contract",
        evidence: "docs/node_python_council_bridge_contract.md",
        status: "implemented",
      },
      {
        step: "sidecar_rehearsal",
        command: "npm run test:bounty-bridge-rehearsal",
        evidence: "reviews/bounty_bridge_rehearsal_latest.json",
        status: "rehearsal_only",
      },
    ],
    observed_operations: [
      {
        operation: "a2a_ingress_auth_configuration",
        status: a2aAuthConfigured ? "configured" : "fail_closed_unconfigured",
      },
      {
        operation: "mailbox_queue_counts",
        status: "observed",
        source: "A2AMailboxQueue.getStats()",
      },
      {
        operation: "continuous_mailbox_to_sidecar_worker",
        status: "not_observed",
      },
      {
        operation: "recent_successful_sidecar_dispatch",
        status: "not_measured",
      },
      {
        operation: "bridge_latency",
        status: "not_measured",
      },
      {
        operation: "sidecar_availability",
        status: "not_measured",
      },
    ],
    mailbox: {
      require_signature: requireSignature,
      registered_trust_keys: registeredTrustKeys,
      signed_envelope_policy: requireSignature ? "required_by_queue" : "not_required_by_queue",
      ed25519_trust_keys_configured: registeredTrustKeys > 0,
      queued_count: Number(stats.queued_count || 0),
      leased_count: Number(stats.leased_count || 0),
      dead_letter_count: Number(stats.dead_letter_count || 0),
    },
    verification_commands: [
      "npm run test:a2a-boundary",
      "npm run test:a2a-mailbox",
      "npm run test:node-python-bridge-contract",
      "npm run test:bounty-bridge-rehearsal",
      "npm run test:operator-telemetry",
      "npm run check:council",
    ],
    open_blockers: [
      "W-0091 non-mock sandbox proof",
      "verified live container isolation",
      "network egress chokepoint proof",
      "public cross-runtime A2A handshake and response signing",
      "operator-approved promotion receipt",
    ],
  };
}
