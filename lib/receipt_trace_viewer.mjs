import crypto from "crypto";

export const TRACE_REPLAY_SCHEMA = "dizzy.trace_replay.v1";
export const TRACE_REPLAY_AUTHORITY = "replay_evidence_not_authority";

export const EXECUTION_STAGES = Object.freeze([
  "INGRESS",
  "ROUTING",
  "MODEL_INVOCATION",
  "TOOL_EVALUATION",
  "EVIDENCE_ASSEMBLY",
  "COUNCIL_VERIFICATION",
  "OPERATOR_GATE",
  "STATE_COMMIT"
]);

export class ReceiptTraceViewer {
  constructor(options = {}) {
    this.strictInvariants = options.strictInvariants !== false;
  }

  /**
   * Reconstructs an execution timeline from heterogeneous receipt streams.
   */
  reconstructTrace(traceId, receipts = []) {
    if (!traceId) {
      throw new Error("reconstructTrace requires a traceId");
    }

    const steps = [];
    let totalLatencyMs = 0;
    let tamperDetected = false;
    const anomalies = [];

    // Sort receipts by timestamp if available
    const sorted = [...receipts].sort((a, b) => {
      const tA = Date.parse(a.timestamp || a.created_at || 0) || 0;
      const tB = Date.parse(b.timestamp || b.created_at || 0) || 0;
      return tA - tB;
    });

    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      const stage = this._identifyStage(r);
      const latency = Number.isFinite(Number(r.latency_ms)) ? Number(r.latency_ms) : 0;
      totalLatencyMs += latency;

      // Compute step state hash
      const stepHash = crypto
        .createHash("sha256")
        .update(`${traceId}:${stage}:${i}:${JSON.stringify(r)}`)
        .digest("hex")
        .slice(0, 16);

      steps.push({
        step_index: i,
        stage,
        schema: r.schema_version || r.schema || "unknown",
        summary: this._summarizeStep(stage, r),
        latency_ms: latency,
        state_hash: stepHash,
        raw_receipt: r
      });
    }

    // Verify stage continuity
    const stagesPresent = new Set(steps.map((s) => s.stage));
    if (!stagesPresent.has("ROUTING") && stagesPresent.has("MODEL_INVOCATION")) {
      anomalies.push("MISSING_PREREQUISITE_STAGE_ROUTING");
    }
    if (stagesPresent.has("STATE_COMMIT") && !stagesPresent.has("COUNCIL_VERIFICATION")) {
      anomalies.push("UNVERIFIED_STATE_COMMIT_WITHOUT_COUNCIL");
      tamperDetected = true;
    }

    const traceSha256 = crypto
      .createHash("sha256")
      .update(`${traceId}:${steps.map((s) => s.state_hash).join("->")}`)
      .digest("hex");

    return {
      schema_version: TRACE_REPLAY_SCHEMA,
      authority: TRACE_REPLAY_AUTHORITY,
      trace_id: traceId,
      step_count: steps.length,
      total_latency_ms: totalLatencyMs,
      tamper_detected: tamperDetected,
      anomalies,
      trace_sha256: traceSha256,
      timeline: steps,
      replay_status: (tamperDetected || anomalies.length > 0) ? "TRACE_ANOMALIES_DETECTED" : "TRACE_VERIFIED_CLEAN"
    };
  }

  /**
   * Generates a readable ASCII machine-room diagram of the execution trace.
   */
  renderAsciiDiagram(traceReplay) {
    if (!traceReplay || !Array.isArray(traceReplay.timeline)) {
      return "[Invalid Trace Replay]";
    }

    const lines = [];
    lines.push(`+==========================================================================+`);
    lines.push(`| DIZZY MACHINE-ROOM TRACE REPLAY: ${traceReplay.trace_id.padEnd(39)} |`);
    lines.push(`| Status: ${(traceReplay.replay_status || "UNKNOWN").padEnd(20)} Total Latency: ${(traceReplay.total_latency_ms + "ms").padEnd(10)} Steps: ${String(traceReplay.step_count).padEnd(4)} |`);
    lines.push(`+==========================================================================+`);

    for (const step of traceReplay.timeline) {
      const stagePadded = `[${step.stage}]`.padEnd(24);
      const hashPadded = `(${step.state_hash})`.padEnd(18);
      lines.push(`  |`);
      lines.push(`  +--> ${stagePadded} ${hashPadded} ${step.summary}`);
      if (step.latency_ms > 0) {
        lines.push(`       Latency: ${step.latency_ms}ms`);
      }
    }

    lines.push(`  |`);
    lines.push(`  +==> [VERDICT] Integrity Hash: ${traceReplay.trace_sha256.slice(0, 16)}...`);
    lines.push(`+==========================================================================+`);

    return lines.join("\n");
  }

  _identifyStage(receipt = {}) {
    const schema = String(receipt.schema_version || receipt.schema || "").toLowerCase();
    if (schema.includes("router_receipt") || receipt.chosen_model || receipt.route_id) return "ROUTING";
    if (schema.includes("tool_call_eval") || receipt.tool || receipt.tool_call) return "TOOL_EVALUATION";
    if (schema.includes("adversarial_verification") || receipt.scenarios_tested) return "EVIDENCE_ASSEMBLY";
    if (schema.includes("council") || receipt.verdict || receipt.supermajority_reached !== undefined) return "COUNCIL_VERIFICATION";
    if (schema.includes("state_transition") || receipt.transition_type) return "STATE_COMMIT";
    if (schema.includes("trace_chain")) return "INGRESS";
    return "MODEL_INVOCATION";
  }

  _summarizeStep(stage, receipt = {}) {
    switch (stage) {
      case "ROUTING":
        return `Route: ${receipt.chosen_model || receipt.route_id || "default"} (Zone: ${receipt.trust_zone || "private_self"})`;
      case "TOOL_EVALUATION":
        return `Tool Call: ${receipt.tool || "generic"} -> ${receipt.overall_status || receipt.qualification_status || "evaluated"}`;
      case "EVIDENCE_ASSEMBLY":
        return `Adversarial Check: ${receipt.verdict || "evaluated"}`;
      case "COUNCIL_VERIFICATION":
        return `Council Verdict: ${receipt.verdict || "PASSED"} (${receipt.consensus_status || "supermajority"})`;
      case "STATE_COMMIT":
        return `State Transition: ${receipt.state_transition || "committed"}`;
      case "INGRESS":
        return `Ingress Request: ${receipt.request?.method || "GET"} ${receipt.request?.route_template || "/"}`;
      default:
        return `Model Invocation: ${receipt.model || "executed"}`;
    }
  }
}
