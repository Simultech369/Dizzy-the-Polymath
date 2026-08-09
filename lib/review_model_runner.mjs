import crypto from "crypto";
import fs from "fs";
import path from "path";
import { openaiCompatGenerateText } from "./openai_compat_client.mjs";
import {
  isRemoteCloudBackend,
  normalizeOpenAICompatModelForBaseUrl,
  resolveDivisionModelRoute,
} from "./model_router.mjs";
import {
  classifyConnectionFailure,
} from "./backend_connection_rca.mjs";
import {
  redactReviewLoopText,
  summarizeHarnessOutput,
} from "./review_cycle_runner.mjs";

export const MODEL_REVIEW_BATCH_SCHEMA = "dizzy.model_review_batch.v1";
export const MODEL_REVIEW_PACKET_SCHEMA = "dizzy.model_review_packet.v1";

const NON_LOCAL_TAGS = new Set(["free", "batch"]);

function env(name, fallback = "") {
  const v = process.env[name];
  return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
}

function sha256Short(value) {
  return crypto.createHash("sha256").update(String(value ?? ""), "utf8").digest("hex").slice(0, 12);
}

function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function atomicWriteText(filePath, text) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tmp, text, "utf8");
  try {
    fs.renameSync(tmp, filePath);
  } catch {
    fs.copyFileSync(tmp, filePath);
    fs.unlinkSync(tmp);
  }
}

function clipText(value = "", maxChars = 12000) {
  const text = redactReviewLoopText(value);
  if (text.length <= maxChars) return text;
  return `[truncated ${text.length - maxChars} chars]\n${text.slice(-maxChars)}`;
}

function normalizeReviewFinding(finding = {}) {
  return {
    kind: String(finding.kind || finding.type || "").slice(0, 80),
    disposition: String(finding.disposition || "new").slice(0, 80),
    severity: String(finding.severity || "medium").slice(0, 40),
    category: String(finding.category || "").slice(0, 80),
    claim: summarizeHarnessOutput(finding.claim || finding.summary || "", 700),
    evidence: Array.isArray(finding.evidence)
      ? finding.evidence.map((item) => summarizeHarnessOutput(item, 240)).slice(0, 5)
      : [],
  };
}

export function isLocalOllamaModelName(model = "") {
  const raw = String(model || "").trim();
  if (!raw) return false;
  const tagMatch = raw.match(/:([^:/]+)$/);
  if (!tagMatch) return false;
  const tag = tagMatch[1].toLowerCase();
  if (NON_LOCAL_TAGS.has(tag)) return false;
  return true;
}

function firstLocalOllamaModel(models = []) {
  return models.find((model) => isLocalOllamaModelName(model)) || "";
}

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("empty model review response");
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  if (!candidate || !candidate.startsWith("{")) throw new Error("model review response did not contain a JSON object");
  return JSON.parse(candidate);
}

export function parseReviewerResponseText(text, reviewer = {}) {
  const parsed = extractJsonObject(text);
  const findings = Array.isArray(parsed.findings) ? parsed.findings.map(normalizeReviewFinding) : [];
  const disagreements = Array.isArray(parsed.disagreements) ? parsed.disagreements.map((item) => normalizeReviewFinding({
    ...item,
    kind: "disagreement",
    category: item.category || "disagreement",
    disposition: item.disposition || "new",
  })) : [];
  return {
    source: reviewer.role_key || parsed.source || "model_review",
    role_key: reviewer.role_key || "",
    status: "submitted",
    summary: summarizeHarnessOutput(parsed.summary || "", 700),
    proposed_state_transition: parsed.state_transition || parsed.proposed_state_transition || "",
    findings: [...findings, ...disagreements],
  };
}

export function resolveReviewerExecutionTarget(reviewer = {}, {
  allowCloud = false,
  trustZone = "private_self",
  preferLocalFallbacks = false,
} = {}) {
  const route = resolveDivisionModelRoute(reviewer.role_key);
  const primaryModel = reviewer.primary_model || route.primary_model || "";
  const localFallbackModel = preferLocalFallbacks
    ? firstLocalOllamaModel([primaryModel, ...(Array.isArray(route.fallbacks) ? route.fallbacks : [])])
    : "";
  if (localFallbackModel && route.backend !== "ollama") {
    const baseUrl = env("OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1");
    const model = normalizeOpenAICompatModelForBaseUrl({
      baseUrl,
      model: localFallbackModel,
      localFallbackModel: env("OLLAMA_MODEL", "gemma3:4b"),
    });
    return {
      executable: true,
      backend: "openai_compat",
      route,
      baseUrl,
      apiKey: env("OLLAMA_API_KEY", ""),
      model,
      selected_reason: "local_free_fallback",
      original_model: primaryModel,
      isLocalIsolationRequired: true,
      base_url_host: safeHost(baseUrl),
    };
  }

  if (route.backend === "framework") {
    return {
      executable: false,
      skipped_reason: "framework_backend_requires_operator_tool",
      route,
      model: primaryModel,
    };
  }
  if (route.backend === "gemini") {
    return {
      executable: false,
      skipped_reason: "gemini_review_backend_not_yet_wired",
      route,
      model: primaryModel,
    };
  }

  const isOllama = route.backend === "ollama";
  const baseUrl = isOllama
    ? env("OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1")
    : env("OPENAI_COMPAT_BASE_URL", "");
  const apiKey = isOllama ? env("OLLAMA_API_KEY", "") : env("OPENAI_COMPAT_API_KEY", "");
  const model = normalizeOpenAICompatModelForBaseUrl({
    baseUrl,
    model: primaryModel,
    localFallbackModel: env("OLLAMA_MODEL", "gemma3:4b"),
  });

  if (!baseUrl) {
    return { executable: false, skipped_reason: "openai_compat_base_url_missing", route, model, backend: "openai_compat", baseUrl };
  }
  const remote = isRemoteCloudBackend("openai_compat", baseUrl);
  if ((remote || trustZone === "private_self") && !allowCloud && !isOllama) {
    return { executable: false, skipped_reason: "cloud_review_blocked_without_allow_cloud", route, model, backend: "openai_compat", baseUrl, base_url_host: safeHost(baseUrl) };
  }
  if (!isOllama && !apiKey) {
    return { executable: false, skipped_reason: "openai_compat_api_key_missing", route, model, backend: "openai_compat", baseUrl, base_url_host: safeHost(baseUrl) };
  }

  return {
    executable: true,
    backend: "openai_compat",
    route,
    baseUrl,
    apiKey,
    model,
    isLocalIsolationRequired: isOllama || trustZone === "private_self",
    base_url_host: safeHost(baseUrl),
  };
}

function safeHost(baseUrl = "") {
  try {
    return new URL(baseUrl).host;
  } catch {
    return "";
  }
}

function buildConnectionDiagnosis({
  target = {},
  reviewer = {},
  error = "",
  allowCloud = false,
  trustZone = "private_self",
} = {}) {
  const reason = String(target.skipped_reason || error || "");
  const shouldDiagnose = /openai_compat_|cloud_review_blocked|local_review_backend|fetch failed|ECONNREFUSED|Unable to connect|connect|TIMEOUT|timed out|HTTP|401|403/i.test(reason);
  if (!shouldDiagnose) return null;
  return classifyConnectionFailure({
    error: error || reason,
    baseUrl: target.baseUrl || "",
    backend: target.backend || target.route?.backend || "openai_compat",
    model: target.model || reviewer.primary_model || "",
    trustZone,
    allowCloud,
    isLocalIsolationRequired: Boolean(target.isLocalIsolationRequired),
  });
}

export function buildReviewerPacket({
  plan,
  reviewer,
  diffText = "",
  maxDiffChars = 12000,
  allowCloud = false,
  trustZone = "private_self",
  preferLocalFallbacks = false,
} = {}) {
  const target = resolveReviewerExecutionTarget(reviewer, { allowCloud, trustZone, preferLocalFallbacks });
  const systemPrompt = [
    "You are a bounded code reviewer for Dizzy/clawd.",
    "Your output is claims-only evidence, not authority.",
    "Find real defects, disagreement points, missing fixtures, overclaims, and scope splits.",
    "Return only JSON. Do not request external actions. Do not claim approval authority.",
  ].join(" ");
  const userPrompt = [
    `Candidate: ${plan?.candidate_id || "unknown"}`,
    `Domains: ${(plan?.domains || []).join(", ") || "unknown"}`,
    `Blast radius: ${plan?.blast_radius || "unknown"}`,
    `Reviewer role: ${reviewer?.role_key || "unknown"} (${reviewer?.lens || "general review"})`,
    `Allowed state transitions: ${(plan?.allowed_state_transitions || []).join(", ")}`,
    "",
    "Return JSON with this shape:",
    "{\"summary\":\"...\",\"findings\":[{\"severity\":\"low|medium|high|critical\",\"category\":\"security|fixture|scope_split|governance|correctness|test_gap|disagreement\",\"claim\":\"...\",\"evidence\":[\"file or observed output\"],\"disposition\":\"new\"}],\"disagreements\":[{\"claim\":\"...\",\"evidence\":[\"...\"]}],\"state_transition\":\"ready-for-review|fixture-required|quarantine|split|reject\"}",
    "",
    "Changed files:",
    (plan?.changed_files || []).join("\n"),
    "",
    "Diff/context:",
    clipText(diffText, maxDiffChars),
  ].join("\n");
  return {
    schema_version: MODEL_REVIEW_PACKET_SCHEMA,
    candidate_id: plan?.candidate_id || "",
    reviewer: {
      role_key: reviewer?.role_key || "",
      division_key: reviewer?.division_key || "",
      primary_model: reviewer?.primary_model || "",
      lens: reviewer?.lens || "",
    },
    target: {
      executable: target.executable,
      skipped_reason: target.skipped_reason || "",
      backend: target.backend || target.route?.backend || "",
      model: target.model || "",
      selected_reason: target.selected_reason || "",
      original_model: target.original_model || "",
      base_url_host: target.base_url_host || "",
    },
    autonomy_boundary: plan?.autonomy_boundary,
    system_prompt: systemPrompt,
    user_prompt: userPrompt,
  };
}

export function buildModelReviewPackets(plan, {
  diffText = "",
  maxDiffChars = 12000,
  allowCloud = false,
  trustZone = "private_self",
  preferLocalFallbacks = false,
} = {}) {
  return (Array.isArray(plan?.reviewer_assignments) ? plan.reviewer_assignments : [])
    .map((reviewer) => buildReviewerPacket({ plan, reviewer, diffText, maxDiffChars, allowCloud, trustZone, preferLocalFallbacks }));
}

export async function executeReviewerModelReview({
  plan,
  reviewer,
  diffText = "",
  allowCloud = false,
  trustZone = "private_self",
  timeoutMs = 60000,
  maxTokens = 900,
  temperature = 0.1,
  preferLocalFallbacks = false,
  generateText = openaiCompatGenerateText,
} = {}) {
  const target = resolveReviewerExecutionTarget(reviewer, { allowCloud, trustZone, preferLocalFallbacks });
  const packet = buildReviewerPacket({ plan, reviewer, diffText, allowCloud, trustZone, preferLocalFallbacks });
  if (!target.executable) {
    const diagnosis = buildConnectionDiagnosis({ target, reviewer, allowCloud, trustZone });
    return {
      source: reviewer.role_key,
      role_key: reviewer.role_key,
      status: "skipped",
      skipped_reason: target.skipped_reason,
      ...(diagnosis ? { diagnosis } : {}),
      findings: [],
    };
  }

  try {
    const text = await generateText({
      baseUrl: target.baseUrl,
      apiKey: target.apiKey,
      model: target.model,
      systemPrompt: packet.system_prompt,
      messages: [{ role: "user", content: packet.user_prompt }],
      timeoutMs,
      temperature,
      maxTokens,
      isLocalIsolationRequired: target.isLocalIsolationRequired,
    });
    let parsed;
    try {
      parsed = parseReviewerResponseText(text, reviewer);
    } catch (err) {
      return {
        source: reviewer.role_key,
        role_key: reviewer.role_key,
        status: "failed",
        failure_stage: "parse",
        error: summarizeHarnessOutput(err?.message || err, 700),
        response_excerpt: summarizeHarnessOutput(text, 700),
        target: {
          backend: target.backend,
          model: target.model,
          selected_reason: target.selected_reason || "",
          original_model: target.original_model || "",
          base_url_host: target.base_url_host,
        },
        findings: [],
      };
    }
    return {
      ...parsed,
      target: {
        backend: target.backend,
        model: target.model,
        selected_reason: target.selected_reason || "",
        original_model: target.original_model || "",
        base_url_host: target.base_url_host,
      },
    };
  } catch (err) {
    const message = String(err?.message || err);
    if (target.isLocalIsolationRequired && /fetch failed|ECONNREFUSED|connect|Unable to connect|TIMEOUT|timed out/i.test(message)) {
      const diagnosis = buildConnectionDiagnosis({ target, reviewer, error: message, allowCloud, trustZone });
      return {
        source: reviewer.role_key,
        role_key: reviewer.role_key,
        status: "skipped",
        skipped_reason: "local_review_backend_unavailable",
        error: summarizeHarnessOutput(message, 700),
        ...(diagnosis ? { diagnosis } : {}),
        findings: [],
      };
    }
    const diagnosis = buildConnectionDiagnosis({ target, reviewer, error: message, allowCloud, trustZone });
    return {
      source: reviewer.role_key,
      role_key: reviewer.role_key,
      status: "failed",
      error: summarizeHarnessOutput(message, 700),
      ...(diagnosis ? { diagnosis } : {}),
      findings: [],
    };
  }
}

export async function runModelReviewBatch({
  plan,
  diffText = "",
  executeModels = false,
  allowCloud = false,
  trustZone = "private_self",
  timeoutMs = 60000,
  maxTokens = 900,
  temperature = 0.1,
  preferLocalFallbacks = false,
  onProgress,
  generateText,
  now = new Date(),
} = {}) {
  if (!plan || typeof plan !== "object") throw new Error("review plan is required");
  const packets = buildModelReviewPackets(plan, { diffText, allowCloud, trustZone, preferLocalFallbacks });
  const reviews = [];
  if (executeModels) {
    for (const reviewer of Array.isArray(plan.reviewer_assignments) ? plan.reviewer_assignments : []) {
      const target = resolveReviewerExecutionTarget(reviewer, { allowCloud, trustZone, preferLocalFallbacks });
      const startedAt = Date.now();
      if (typeof onProgress === "function") {
        onProgress({
          event: "reviewer_started",
          role_key: reviewer.role_key,
          model: target.model || reviewer.primary_model || "",
          selected_reason: target.selected_reason || "",
        });
      }
      const review = await executeReviewerModelReview({
        plan,
        reviewer,
        diffText,
        allowCloud,
        trustZone,
        timeoutMs,
        maxTokens,
        temperature,
        preferLocalFallbacks,
        ...(generateText ? { generateText } : {}),
      });
      reviews.push(review);
      if (typeof onProgress === "function") {
        onProgress({
          event: "reviewer_finished",
          role_key: reviewer.role_key,
          status: review.status || "unknown",
          skipped_reason: review.skipped_reason || "",
          error: review.error || "",
          seconds: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
        });
      }
    }
  }

  return {
    schema_version: MODEL_REVIEW_BATCH_SCHEMA,
    batch_id: `model_reviews_${sha256Short(JSON.stringify({
      candidate_id: plan.candidate_id,
      created_at: nowIso(now),
      reviewers: packets.map((packet) => packet.reviewer.role_key),
    }))}`,
    candidate_id: plan.candidate_id || "",
    created_at: nowIso(now),
    execute_models: Boolean(executeModels),
    allow_cloud: Boolean(allowCloud),
    prefer_local_fallbacks: Boolean(preferLocalFallbacks),
    authority: "model_output_is_claims_only_local_evidence_decides",
    packets,
    reviews,
  };
}

export function writeModelReviewBatch(batch, {
  rootDir = process.cwd(),
  outPath = "reviews/model_review_batch_latest.json",
} = {}) {
  const absPath = path.resolve(rootDir, outPath);
  atomicWriteText(absPath, `${JSON.stringify(batch, null, 2)}\n`);
  return absPath;
}
