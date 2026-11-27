# Explicit Workflows and State Machines

Status: Runtime-Enforced Architecture Rule (Phase 0.5)

## Standing Rule for Multi-Step Work

Every multi-step workflow in Dizzy or CouncilEngine must define:

1. **Named states** (enumerated string constants, never ad hoc boolean flags).
2. **Explicit allowed transitions** (`from_state -> [allowed_next_states]`) and terminal states.
3. **Clear next-step guidance** so operators, developers, and coding agents know what unblocks the workflow.
4. **Durable progress / receipts** when crossing trust, network, tool, or human-approval boundaries so crashes can resume safely.
5. **Deterministic tests** proving both legal progressions and failure on illegal state jumps (`IllegalWorkflowTransitionError`).

Executable state-machine definitions live in [`lib/workflow_state_machines.mjs`](../lib/workflow_state_machines.mjs).

---

## Complete Catalog of Staged Workflows

| Workflow ID | Owner | States | Persistence / Receipt | Proof Command |
| :--- | :--- | :--- | :--- | :--- |
| `human_approval` | Dizzy + CouncilEngine | `running -> waiting_for_approval -> approved \| rejected -> resumed \| cancelled` | `runtime/hitl/runs.jsonl`, `checkpoints.jsonl`, `audit_log.jsonl` | `npm run test:workflow-states` |
| `streaming_response` | Dizzy | `open -> streaming -> stalled -> completed \| aborted` | `dizzy.stream_receipt.v1` | `npm run test:streaming-response` |
| `statem_runbook` | Dizzy + CouncilEngine | `plan -> execute <-> verify -> handoff` | `runtime/checkpoints/statem.jsonl` | `npm run test:statem-runbook` |
| `cognitive_memory_lifecycle` | Dizzy | `captured -> consolidated -> retrieved -> reconciled -> decayed \| deleted` | Zone-partitioned wiki + `dizzy.cognitive_memory_receipt.v1` | `npm run test:cognitive-memory` |
| `tool_execution_guardrails` | Dizzy | `session_start -> pre_tool_check -> executing_sandbox -> post_tool_scrub -> completed \| denied` | `dizzy.tool_guardrail_receipt.v1` | `npm run test:tool-guardrails` |
| `a2a_mailbox_delivery` | Dizzy | `signed_ingress -> sanitized_queued -> leased -> acked \| expired_requeued \| dead_letter` | `dizzy.a2a_dispatch_receipt.v1`, `dizzy.inter_agent_proxy_receipt.v1` | `npm run test:a2a-mailbox` |
| `model_routing_fallback` | Dizzy | `classified -> budget_checked -> primary_attempt -> fallback_attempt -> local_or_cache_degraded \| hitl_approval_required \| failed_closed` | `dizzy.routing_delta_receipt.v1` | `npm run test:routing-policy` |
| `context_assembly_budget` | Dizzy | `zone_scoped -> sources_admitted -> scored_deduped -> packed \| truncated_with_receipt \| failed_safe_overflow` | `dizzy.context_assembler.v2` | `npm run test:context-packer` |
| `pii_safe_external_inference` | Dizzy | `raw_input -> egress_zone_checked -> masked_placeholders -> hosted_call -> rehydrated \| blocked_private_leak` | `dizzy.pii_inference_proxy_receipt.v1` | `npm run test:pii-proxy` |
| `external_event_triggers` | Dizzy | `event_received -> code_filtered -> subscribed_worker_routed \| model_triaged \| dropped_noise` | `dizzy.event_trigger_receipt.v1` | `npm run test:event-triggers` |
| `worker_job_queue` | Dizzy | `queued -> running -> succeeded \| retry_scheduled \| dead` | Redis/local queue + `runtime/dlq/*.jsonl` | `npm test` |
| `consistency_boundary_promotion` | Dizzy + CouncilEngine | `SYNTHETIC_REHEARSAL -> LOCAL_RECEIPT_VERIFIED -> GLOBAL_CONSENSUS_FINALIZED` | `dizzy.trajectory_contract_receipt.v1` | `npm run test:consistency-boundary` |
| `council_verification_bridge` | Dizzy + CouncilEngine | `queued -> verifying -> waiting_for_approval -> approved \| rejected \| blocked` | `dizzy.node_python_council_bridge_contract.v1` | `npm run test:dizzy-council-contract` |
| `client_continuity_retention` | Dizzy | `clean_start -> reused_scoped_context -> exported \| pruned_expired \| deleted_by_operator` | `runtime/continuity/*.json` | `npm test` |
| `dashboard_ui_lifecycle` | Dizzy | `booting -> checking_session -> loading_data -> ready \| degraded_offline \| auth_required` | Browser `localStorage` prefs + session cookie | `npm run test:dashboard-public-surface` |

---

## Primary Explicit State Machine: Human Approval (`human_approval`)

Shared across Dizzy ([`lib/hitl_approval_gateway.mjs`](../lib/hitl_approval_gateway.mjs)) and CouncilEngine (`human_approval.py`):

```text
running
  |-- requestApproval() --> waiting_for_approval
  |                           |-- approve() --> approved
  |                           |                   |-- resumeCheckpoint() --> resumed (terminal)
  |                           |                   +-- cancelRun() ---------> cancelled (terminal)
  |                           |-- reject() ---> rejected
  |                           |                   +-- cancelRun() ---------> cancelled (terminal)
  |                           +-- cancelRun() / TTL expiry ----------------> cancelled (terminal)
  +-- cancelRun() ---------------------------------------------------------> cancelled (terminal)
```

### Crash Recovery Guarantee
- `startRun()` and `saveProgress()` append durable snapshots (`step_index`, `step_name`, `completed_steps`, `partial_outputs`) to `runtime/hitl/runs.jsonl`.
- `requestApproval()` binds the saved progress and action digest into an HMAC-signed `resume_token` in `runtime/hitl/checkpoints.jsonl`.
- On process restart, `HitlApprovalGateway` reconstructs in-memory state from `runs.jsonl`, `checkpoints.jsonl`, and hash-chained `audit_log.jsonl`. `listRecoverableRuns()` surfaces interrupted runs in the Operator Inbox, and `resumeCheckpoint()` restores the exact saved step once `approved`.
- Illegal jumps (`running -> approved`, `running -> resumed`, `waiting_for_approval -> resumed`, `rejected -> resumed`, `resumed -> resumed`, `cancelled -> running`) throw `IllegalWorkflowTransitionError` (`code: "ILLEGAL_STATE_TRANSITION"`).

---

## Secondary Explicit State Machine: Streaming Response (`streaming_response`)

Enforced in [`lib/sse_stream.mjs`](../lib/sse_stream.mjs) (`StreamingLatencyTracker` + `createStreamStateMachine`):

```text
open -> streaming <-> stalled -> completed (terminal)
  |         |            |
  +---------+------------+-----> aborted (terminal)
```

- Frames emitted after `completed` or `aborted`, or attempts to transition back to `open`, throw `IllegalWorkflowTransitionError`.
