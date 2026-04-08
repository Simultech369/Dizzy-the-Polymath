import crypto from "crypto";
import fs from "fs";
import path from "path";
import { assessCandidatePayload, buildPreparedCandidatePayload, expectedRequestKey, sanitizeOrderId, stableStringify } from "./lib/order_fulfillment.mjs";

const BASE = "https://atelierai.xyz/api";
const API_KEY = process.env.ATELIER_API_KEY;
const AGENT_ID = process.env.ATELIER_AGENT_ID;
const EXECUTION_MODE = (process.env.DIZZY_EXECUTION_MODE || "dry_run").toLowerCase();
const POLL_INTERVAL_MS = Number(process.env.DIZZY_POLL_INTERVAL_MS || 60_000);
const ITERATION_CAP = Number(process.env.DIZZY_ITERATION_CAP || 3);
const RUN_ONCE = process.env.DIZZY_RUN_ONCE === "1";
const RUNTIME_ROOT = path.resolve(process.env.DIZZY_RUNTIME_ROOT || path.join("runtime", "orders"));
const MANUAL_DELIVER_IDS = new Set(
  (process.env.DIZZY_MANUAL_DELIVER_ORDER_IDS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
);

const ALLOWED_MODES = new Set(["dry_run", "generate_qc", "manual_delivery"]);
if (!ALLOWED_MODES.has(EXECUTION_MODE)) {
  console.error(`Invalid DIZZY_EXECUTION_MODE="${EXECUTION_MODE}". Allowed: dry_run | generate_qc | manual_delivery.`);
  process.exit(1);
}

if (!API_KEY || !AGENT_ID) {
  console.error("Missing env vars. Set ATELIER_API_KEY and ATELIER_AGENT_ID in PowerShell.");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${API_KEY}` };
const RESTRICTED_PATTERNS = [
  /\bminor\b/i,
  /\bunderage\b/i,
  /\bnon[- ]?consensual\b/i,
  /\bsexual violence\b/i,
  /\bexploit(?:ation)?\b/i,
  /\billegal\b/i,
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getOrderDir(orderId) {
  return path.join(RUNTIME_ROOT, sanitizeOrderId(orderId));
}

function artifactFilePath(orderId, type, key) {
  return path.join(getOrderDir(orderId), `${type}-${key}.json`);
}

function canonicalStatePath(orderId) {
  return path.join(getOrderDir(orderId), "state.json");
}

function writeCanonicalState(orderId, state) {
  ensureDir(getOrderDir(orderId));
  fs.writeFileSync(canonicalStatePath(orderId), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function appendArtifact(orderId, type, payload) {
  ensureDir(getOrderDir(orderId));
  const payloadCanonical = stableStringify(payload);
  const key = sha256Text(`${type}:${payloadCanonical}`).slice(0, 20);
  const filePath = artifactFilePath(orderId, type, key);

  if (fs.existsSync(filePath)) {
    const existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return { wrote: false, record: existing, filePath };
  }

  const record = {
    type,
    key,
    created_at: new Date().toISOString(),
    payload,
  };
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return { wrote: true, record, filePath };
}

function loadArtifacts(orderId) {
  const dir = getOrderDir(orderId);
  const grouped = {
    intake: [],
    candidate: [],
    qc: [],
    upload: [],
    delivery: [],
    diagnostic: [],
  };

  if (!fs.existsSync(dir)) return grouped;
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();

  for (const fileName of files) {
    const filePath = path.join(dir, fileName);
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (grouped[parsed.type]) grouped[parsed.type].push(parsed);
    } catch (err) {
      grouped.diagnostic.push({
        type: "diagnostic",
        key: `parse_error_${fileName}`,
        created_at: new Date().toISOString(),
        payload: { issue: "artifact_parse_error", file_name: fileName, error: String(err?.message || err) },
      });
    }
  }

  for (const type of Object.keys(grouped)) {
    grouped[type].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  }
  return grouped;
}

function latest(records) {
  return records.length ? records[records.length - 1] : null;
}

function normalizeOrder(order) {
  return {
    order_id: String(order?.id ?? ""),
    service_id: order?.service_id ?? null,
    status: order?.status ?? null,
    brief: String(order?.brief ?? "").trim(),
    created_at: order?.created_at ?? null,
    updated_at: order?.updated_at ?? null,
  };
}
function deriveFacts(order, artifacts) {
  const currentRequestKey = expectedRequestKey(order);
  const latestCandidate = latest(artifacts.candidate);
  const qcForCandidate = latestCandidate
    ? artifacts.qc.filter((r) => r?.payload?.candidate_key === latestCandidate.key)
    : [];
  const latestQc = latest(qcForCandidate);
  const uploadForCandidate = latestCandidate
    ? artifacts.upload.filter((r) => r?.payload?.candidate_key === latestCandidate.key)
    : [];
  const latestUpload = latest(uploadForCandidate);
  const deliveryForUpload = latestUpload
    ? artifacts.delivery.filter((r) => r?.payload?.upload_key === latestUpload.key)
    : [];
  const latestDelivery = latest(deliveryForUpload);

  return {
    orderId: order.order_id,
    currentRequestKey,
    hasIntake: artifacts.intake.length > 0,
    candidateCount: artifacts.candidate.length,
    latestCandidate,
    latestCandidateMatchesRequest: Boolean(latestCandidate?.payload?.request_key) && latestCandidate.payload.request_key === currentRequestKey,
    hasQcForCandidate: Boolean(latestQc),
    hasQcPassForCandidate: latestQc?.payload?.qc_status === "PASS",
    hasQcFailForCandidate: Boolean(latestQc) && latestQc?.payload?.qc_status !== "PASS",
    latestQc,
    latestUpload,
    hasUploadForCandidate: Boolean(latestUpload),
    hasDeliveryForUpload: Boolean(latestDelivery),
    latestDelivery,
    remoteAlreadyDelivered: String(order.status || "").toLowerCase() === "delivered",
  };
}

function evaluatePolicies(order, facts) {
  const reasons = [];

  if (!order.brief) reasons.push({ code: "missing_brief", level: "revise", message: "Brief is empty." });
  if (RESTRICTED_PATTERNS.some((re) => re.test(order.brief))) {
    reasons.push({ code: "restricted_content", level: "block", message: "Brief matches restricted-content heuristic." });
  }
  if (facts.candidateCount >= ITERATION_CAP && !facts.hasQcPassForCandidate) {
    reasons.push({
      code: "iteration_cap_reached",
      level: "block",
      message: `Iteration cap reached (${ITERATION_CAP}).`,
    });
  }

  const decision = reasons.some((r) => r.level === "block")
    ? "block"
    : reasons.some((r) => r.level === "revise")
      ? "revise"
      : "allow";
  return { decision, reasons };
}

function decideNextAction(facts, policy) {
  if (facts.remoteAlreadyDelivered || facts.hasDeliveryForUpload) return { type: "NOOP", reason: "already_delivered" };
  if (!facts.hasIntake) return { type: "WRITE_INTAKE", reason: "missing_intake_artifact" };
  if (policy.decision !== "allow") return { type: "WRITE_DIAGNOSTIC", reason: `policy_${policy.decision}` };
  if (!facts.latestCandidate) return { type: "GENERATE", reason: "missing_candidate" };
  if (!facts.latestCandidateMatchesRequest) return { type: "GENERATE", reason: "candidate_stale_for_brief" };
  if (!facts.hasQcForCandidate) return { type: "RUN_QC", reason: "missing_qc" };
  if (facts.hasQcFailForCandidate) return { type: "GENERATE", reason: "qc_failed_try_next_attempt" };
  if (!facts.hasUploadForCandidate) return { type: "UPLOAD", reason: "missing_upload" };
  if (!facts.hasDeliveryForUpload) return { type: "DELIVER", reason: "missing_delivery" };
  return { type: "NOOP", reason: "nothing_missing" };
}

async function pollOrders() {
  const res = await fetch(`${BASE}/agents/${AGENT_ID}/orders?status=paid,in_progress`, { headers });
  if (!res.ok) throw new Error(`pollOrders failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.data || [];
}

async function uploadFile(filePath) {
  const buf = fs.readFileSync(filePath);
  const blob = new Blob([buf], { type: "image/png" });

  const form = new FormData();
  form.append("file", blob, path.basename(filePath));

  const res = await fetch(`${BASE}/upload`, { method: "POST", headers, body: form });
  if (!res.ok) throw new Error(`upload failed: ${res.status} ${await res.text()}`);

  const json = await res.json();
  return { url: json.data.url, mediaType: json.data.media_type };
}

async function deliver(orderId, url, mediaType) {
  const res = await fetch(`${BASE}/orders/${orderId}/deliver`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ deliverable_url: url, deliverable_media_type: mediaType }),
  });
  if (!res.ok) throw new Error(`deliver failed: ${res.status} ${await res.text()}`);
  return { status: res.status };
}

function runQc(candidateRecord, order) {
  const filePath = candidateRecord?.payload?.file_path;
  const candidateAssessment = assessCandidatePayload(candidateRecord?.payload, order, RUNTIME_ROOT);
  const checks = {
    file_exists: Boolean(filePath && fs.existsSync(filePath)),
    is_png: String(filePath || "").toLowerCase().endsWith(".png"),
    file_size_bytes: 0,
    payload_deliverable: candidateAssessment.ok,
    payload_issues: candidateAssessment.issues,
  };

  if (checks.file_exists) {
    checks.file_size_bytes = fs.statSync(filePath).size;
  }

  const pass = checks.file_exists && checks.is_png && checks.file_size_bytes > 0 && candidateAssessment.ok;
  return {
    candidate_key: candidateRecord.key,
    qc_status: pass ? "PASS" : "FAILED_QC",
    checks,
    clinical_critique: pass
      ? ["Prepared asset is present, order-scoped, and structurally eligible for delivery.", "Automated visual quality beyond structural gating is not yet implemented."]
      : ["Candidate is missing, invalid, stale, or placeholder-grade.", "Upload/delivery is blocked until a prepared order-scoped asset exists with valid metadata."],
  };
}
async function executeAction(order, artifacts, facts, policy, action) {
  const orderId = order.order_id;
  const baseDiagnostic = {
    mode: EXECUTION_MODE,
    reason: action.reason,
    policy_decision: policy.decision,
    policy_reasons: policy.reasons,
  };

  switch (action.type) {
    case "NOOP":
      return appendArtifact(orderId, "diagnostic", { ...baseDiagnostic, event: "noop" });

    case "WRITE_INTAKE":
      return appendArtifact(orderId, "intake", order);

    case "WRITE_DIAGNOSTIC":
      return appendArtifact(orderId, "diagnostic", { ...baseDiagnostic, event: "policy_gate" });

    case "GENERATE":
      if (EXECUTION_MODE === "dry_run") {
        return appendArtifact(orderId, "diagnostic", { ...baseDiagnostic, event: "dry_run_skip_generate" });
      }
      {
        const prepared = buildPreparedCandidatePayload(order, facts, RUNTIME_ROOT);
        if (!prepared.ok) {
          return appendArtifact(orderId, "diagnostic", {
            ...baseDiagnostic,
            event: "generate_requires_prepared_candidate",
            detail: prepared.detail ?? "",
            prepared_candidate_reason: prepared.reason,
          });
        }
        return appendArtifact(orderId, "candidate", prepared.payload);
      }

    case "RUN_QC":
      if (EXECUTION_MODE === "dry_run") {
        return appendArtifact(orderId, "diagnostic", { ...baseDiagnostic, event: "dry_run_skip_qc" });
      }
      return appendArtifact(orderId, "qc", runQc(facts.latestCandidate, order));

    case "UPLOAD":
      if (EXECUTION_MODE !== "manual_delivery") {
        return appendArtifact(orderId, "diagnostic", { ...baseDiagnostic, event: "upload_blocked_by_mode" });
      }
      if (!facts.latestCandidate?.payload?.file_path) {
        return appendArtifact(orderId, "diagnostic", { ...baseDiagnostic, event: "upload_missing_candidate_path" });
      }
      {
        const candidateAssessment = assessCandidatePayload(facts.latestCandidate.payload, order, RUNTIME_ROOT);
        if (!candidateAssessment.ok) {
          return appendArtifact(orderId, "diagnostic", {
            ...baseDiagnostic,
            event: "upload_blocked_invalid_candidate",
            candidate_issues: candidateAssessment.issues,
          });
        }
      }
      {
        const uploadResult = await uploadFile(facts.latestCandidate.payload.file_path);
        return appendArtifact(orderId, "upload", {
          candidate_key: facts.latestCandidate.key,
          uploaded_url: uploadResult.url,
          uploaded_media_type: uploadResult.mediaType,
        });
      }

    case "DELIVER":
      if (EXECUTION_MODE !== "manual_delivery") {
        return appendArtifact(orderId, "diagnostic", { ...baseDiagnostic, event: "deliver_blocked_by_mode" });
      }
      if (!MANUAL_DELIVER_IDS.has(orderId)) {
        return appendArtifact(orderId, "diagnostic", { ...baseDiagnostic, event: "deliver_not_allowlisted" });
      }
      if (!facts.latestUpload?.payload?.uploaded_url || !facts.latestUpload?.payload?.uploaded_media_type) {
        return appendArtifact(orderId, "diagnostic", { ...baseDiagnostic, event: "deliver_missing_upload_record" });
      }
      {
        const candidateAssessment = assessCandidatePayload(facts.latestCandidate?.payload, order, RUNTIME_ROOT);
        if (!candidateAssessment.ok) {
          return appendArtifact(orderId, "diagnostic", {
            ...baseDiagnostic,
            event: "deliver_blocked_invalid_candidate",
            candidate_issues: candidateAssessment.issues,
          });
        }
      }
      {
        const deliveryResult = await deliver(
          orderId,
          facts.latestUpload.payload.uploaded_url,
          facts.latestUpload.payload.uploaded_media_type,
        );
        return appendArtifact(orderId, "delivery", {
          upload_key: facts.latestUpload.key,
          delivered_url: facts.latestUpload.payload.uploaded_url,
          delivered_media_type: facts.latestUpload.payload.uploaded_media_type,
          response_status: deliveryResult.status,
        });
      }

    default:
      return appendArtifact(orderId, "diagnostic", { ...baseDiagnostic, event: "unknown_action" });
  }
}

async function reconcileOrder(orderRaw) {
  const order = normalizeOrder(orderRaw);
  if (!order.order_id) return;

  const artifacts = loadArtifacts(order.order_id);
  const facts = deriveFacts(order, artifacts);
  const policy = evaluatePolicies(order, facts);
  const action = decideNextAction(facts, policy);

  console.log(`\n=== Order ${order.order_id} ===`);
  console.log(`Brief: ${order.brief || "(empty)"}`);
  console.log(`Mode=${EXECUTION_MODE} action=${action.type} reason=${action.reason}`);

  const result = await executeAction(order, artifacts, facts, policy, action);
  const wroteText = result.wrote ? "wrote" : "reused";
  console.log(`${wroteText} artifact: ${path.basename(result.filePath)}`);

  writeCanonicalState(order.order_id, {
    computed_at: new Date().toISOString(),
    mode: EXECUTION_MODE,
    order,
    facts,
    policy,
    action,
    last_artifact: {
      wrote: result.wrote,
      type: result.record?.type ?? null,
      key: result.record?.key ?? null,
      file_name: path.basename(result.filePath),
    },
  });
}

async function main() {
  ensureDir(RUNTIME_ROOT);
  console.log(`Dizzy stateless reconcile running. mode=${EXECUTION_MODE} poll=${POLL_INTERVAL_MS}ms root=${RUNTIME_ROOT}`);

  while (true) {
    try {
      const orders = await pollOrders();
      for (const order of orders) {
        await reconcileOrder(order);
      }
    } catch (e) {
      console.error("Loop error:", e?.message || e);
    }

    if (RUN_ONCE) break;
    await sleep(POLL_INTERVAL_MS);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
