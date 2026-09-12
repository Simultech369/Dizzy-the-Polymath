import { assembleContext } from '../../lib/context_assembler.mjs';

const MOCK_SNAPSHOT = {
  snapshot_id: "snap_eval_1",
  as_of: new Date().toISOString(),
  records: [
    {
      id: "a2a_mailbox_guidelines",
      title: "a2a_mailbox_guidelines",
      content: "Detailed information about A2A mailboxes: Mailbox Queue supports required Ed25519 or HMAC-SHA256 signatures for a2a_signed_envelope.v1. Receipts are returned with leases.",
      trust_zone: "private_self",
      status: "active",
      source_sha256: "hash1"
    },
    {
      id: "handoff_process",
      title: "handoff_process",
      content: "The handoff process requires verifying sidecar isolation and creating a PR packet. No untested handoff files.",
      trust_zone: "private_self",
      status: "active",
      source_sha256: "hash2"
    },
    {
      id: "internal_keys",
      title: "internal_keys",
      content: "Secret internal keys and passwords: do_not_export data should never leak.",
      trust_zone: "private_self",
      sensitivity_tier: "do_not_export",
      status: "active",
      source_sha256: "hash3"
    }
  ]
};

export default async function callApi(prompt, context) {
  try {
    const trustZone = context.vars.trust_zone || "private_self";
    const budgetBytes = Number(context.vars.budget_bytes) || 50000;
    
    const output = assembleContext({
      trust_zone: trustZone,
      task: prompt,
      budget_bytes: budgetBytes,
      allowed_sources: MOCK_SNAPSHOT
    });
    
    return { output: output.packed_context || "NO_CONTEXT" };
  } catch (err) {
    return { error: String(err) };
  }
}
