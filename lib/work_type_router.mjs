/**
 * Work-Type Router, Deterministic Math/Logic Evaluator, Bounded Structured-Output Retry,
 * and Ordered Provider Fallback Cascade (Phase 1 & Phase 3b).
 *
 * Rules enforced:
 * 1. Math & symbolic logic -> deterministic local code or offline CouncilEngine checks ($0.00 LLM spend).
 *    Language models are reserved primarily for natural-language synthesis and conversation.
 * 2. Structured output validation failures retry a bounded number of times (<= 3) and record a receipt.
 * 3. When models/APIs are down, fall back in strict order:
 *      stronger -> weaker -> local -> cache -> degraded_unavailable
 *    and report degraded status clearly without raw stack traces.
 */

import crypto from "node:crypto";

export const WORK_TYPE_RECEIPT_SCHEMA = "dizzy.work_type_route_receipt.v1";
export const STRUCTURED_RETRY_RECEIPT_SCHEMA = "dizzy.structured_output_retry_receipt.v1";
export const FALLBACK_CASCADE_RECEIPT_SCHEMA = "dizzy.ordered_fallback_receipt.v1";

function stableJson(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256HexLower(value) {
  return crypto.createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

/**
 * Safe recursive-descent arithmetic parser (NO eval / Function constructor).
 * Supports +, -, *, /, %, ^, parentheses, unary +/-, and "X% of Y".
 */
export function evaluateSafeMathExpression(rawInput) {
  let cleaned = String(rawInput || "").trim();
  cleaned = cleaned.replace(/^(?:what\s+is|calculate|compute|evaluate|solve)\s+/i, "").replace(/\?+$/, "").trim();

  // Support "15% of 4800"
  const pctOfMatch = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*%\s+of\s+(-?\d+(?:\.\d+)?)$/i);
  if (pctOfMatch) {
    const pct = Number(pctOfMatch[1]);
    const base = Number(pctOfMatch[2]);
    if (!Number.isFinite(pct) || !Number.isFinite(base)) return { ok: false };
    const value = Math.round((pct / 100) * base * 1e9) / 1e9;
    return { ok: true, expression: `${pct}% of ${base}`, value };
  }

  if (!/^[0-9+\-*/%^().\s]+$/.test(cleaned) || !/[0-9]/.test(cleaned) || !/[+\-*/%^]/.test(cleaned)) {
    return { ok: false };
  }
  if (cleaned.length > 256) {
    return { ok: false, error: "expression_too_long" };
  }

  const tokens = [];
  let i = 0;
  while (i < cleaned.length) {
    const ch = cleaned[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if ("+-*/%^()".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = "";
      while (i < cleaned.length && /[0-9.]/.test(cleaned[i])) {
        numStr += cleaned[i];
        i += 1;
      }
      if ((numStr.match(/\./g) || []).length > 1) return { ok: false };
      const num = Number(numStr);
      if (!Number.isFinite(num)) return { ok: false };
      tokens.push({ type: "num", value: num });
      continue;
    }
    return { ok: false };
  }

  let pos = 0;
  function peek() {
    return tokens[pos] || null;
  }
  function consume() {
    const tok = tokens[pos];
    pos += 1;
    return tok;
  }

  function parseAddSub() {
    let left = parseMulDiv();
    while (peek()?.type === "op" && (peek().value === "+" || peek().value === "-")) {
      const op = consume().value;
      const right = parseMulDiv();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseMulDiv() {
    let left = parsePower();
    while (peek()?.type === "op" && (peek().value === "*" || peek().value === "/" || peek().value === "%")) {
      const op = consume().value;
      const right = parsePower();
      if ((op === "/" || op === "%") && right === 0) {
        throw new Error("division_by_zero");
      }
      if (op === "*") left *= right;
      else if (op === "/") left /= right;
      else left %= right;
    }
    return left;
  }

  function parsePower() {
    const base = parseUnary();
    if (peek()?.type === "op" && peek().value === "^") {
      consume();
      const exp = parsePower();
      if (Math.abs(exp) > 1024) throw new Error("exponent_out_of_bounds");
      return Math.pow(base, exp);
    }
    return base;
  }

  function parseUnary() {
    if (peek()?.type === "op" && (peek().value === "+" || peek().value === "-")) {
      const op = consume().value;
      const val = parseUnary();
      return op === "-" ? -val : val;
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const tok = peek();
    if (!tok) throw new Error("unexpected_end");
    if (tok.type === "num") {
      consume();
      return tok.value;
    }
    if (tok.type === "op" && tok.value === "(") {
      consume();
      const inner = parseAddSub();
      if (peek()?.type !== "op" || peek().value !== ")") {
        throw new Error("unclosed_paren");
      }
      consume();
      return inner;
    }
    throw new Error("unexpected_token");
  }

  try {
    const result = parseAddSub();
    if (pos !== tokens.length || !Number.isFinite(result)) return { ok: false };
    const rounded = Math.round(result * 1e9) / 1e9;
    return { ok: true, expression: cleaned, value: rounded };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Safe deterministic boolean & comparison logic evaluator (NO eval).
 * Supports TRUE, FALSE, NOT, AND, OR, parentheses, and numeric comparisons (==, !=, <=, >=, <, >).
 */
export function evaluateSafeLogicExpression(rawInput) {
  let cleaned = String(rawInput || "").trim();
  cleaned = cleaned.replace(/^(?:evaluate\s+logic|check\s+invariant|is\s+it\s+true\s+that)[:\s]+/i, "").replace(/\?+$/, "").trim();
  if (cleaned.length === 0 || cleaned.length > 256) return { ok: false };

  // Must contain explicit boolean operators or comparison operators without natural-language prose
  const normalized = cleaned
    .replace(/&&/g, " AND ")
    .replace(/\|\|/g, " OR ");

  if (!/^(?:true|false|and|or|not|==|!=|<=|>=|<|>|\(|\)|-?\d+(?:\.\d+)?|\s)+$/i.test(normalized)) {
    return { ok: false };
  }
  if (!/\b(?:and|or|not|true|false)\b|==|!=|<=|>=|<|>/i.test(normalized)) {
    return { ok: false };
  }

  // First reduce numeric comparisons like `120 >= 100` -> `true`
  const withComparisons = normalized.replace(
    /(-?\d+(?:\.\d+)?)\s*(==|!=|<=|>=|<|>)\s*(-?\d+(?:\.\d+)?)/g,
    (_, leftStr, op, rightStr) => {
      const a = Number(leftStr);
      const b = Number(rightStr);
      if (op === "==") return a === b ? "true" : "false";
      if (op === "!=") return a !== b ? "true" : "false";
      if (op === "<=") return a <= b ? "true" : "false";
      if (op === ">=") return a >= b ? "true" : "false";
      if (op === "<") return a < b ? "true" : "false";
      return a > b ? "true" : "false";
    }
  );

  const tokens = withComparisons.match(/\(|\)|\b(?:true|false|and|or|not)\b/gi);
  if (!tokens || tokens.join(" ").replace(/\s+/g, "").length !== withComparisons.replace(/\s+/g, "").length) {
    return { ok: false };
  }

  let pos = 0;
  const peek = () => (tokens[pos] ? tokens[pos].toUpperCase() : null);
  const consume = () => tokens[pos++].toUpperCase();

  function parseOr() {
    let val = parseAnd();
    while (peek() === "OR") {
      consume();
      const rhs = parseAnd();
      val = val || rhs;
    }
    return val;
  }

  function parseAnd() {
    let val = parseNot();
    while (peek() === "AND") {
      consume();
      const rhs = parseNot();
      val = val && rhs;
    }
    return val;
  }

  function parseNot() {
    if (peek() === "NOT") {
      consume();
      return !parseNot();
    }
    return parseAtom();
  }

  function parseAtom() {
    const tok = peek();
    if (tok === "TRUE") {
      consume();
      return true;
    }
    if (tok === "FALSE") {
      consume();
      return false;
    }
    if (tok === "(") {
      consume();
      const inner = parseOr();
      if (peek() !== ")") throw new Error("unclosed_paren");
      consume();
      return inner;
    }
    throw new Error("unexpected_logic_token");
  }

  try {
    const result = parseOr();
    if (pos !== tokens.length) return { ok: false };
    return { ok: true, expression: cleaned, value: result };
  } catch {
    return { ok: false };
  }
}

const COUNCIL_VERIFICATION_RE = /^(?:verify\s+patch|check\s+cwe|council\s+verify|check\s+promotion\s+blockers)\b[:\s]*/i;

/**
 * Classifies work by type and executes deterministic math/logic/Council verification locally
 * without invoking a language model.
 */
export function classifyAndRouteWorkType(inputText, { councilVerifyFn = null, now = new Date() } = {}) {
  const text = String(inputText ?? "").trim();
  const nowIso = now instanceof Date ? now.toISOString() : new Date(now).toISOString();

  // 1. Deterministic Math
  const mathRes = evaluateSafeMathExpression(text);
  if (mathRes.ok) {
    const receiptCore = {
      schema_version: WORK_TYPE_RECEIPT_SCHEMA,
      timestamp: nowIso,
      work_type: "deterministic_math",
      selected_tier: "T0",
      execution_surface: "deterministic_code",
      llm_invoked: false,
      cost_usd: 0,
      input_sha256: sha256HexLower(text),
    };
    return {
      work_type: "deterministic_math",
      handled_deterministically: true,
      llm_invoked: false,
      answer: String(mathRes.value),
      details: mathRes,
      receipt: { ...receiptCore, receipt_sha256: sha256HexLower(stableJson(receiptCore)) },
    };
  }

  // 2. Deterministic Boolean / Comparison Logic
  const logicRes = evaluateSafeLogicExpression(text);
  if (logicRes.ok) {
    const receiptCore = {
      schema_version: WORK_TYPE_RECEIPT_SCHEMA,
      timestamp: nowIso,
      work_type: "deterministic_logic",
      selected_tier: "T0",
      execution_surface: "deterministic_code",
      llm_invoked: false,
      cost_usd: 0,
      input_sha256: sha256HexLower(text),
    };
    return {
      work_type: "deterministic_logic",
      handled_deterministically: true,
      llm_invoked: false,
      answer: String(logicRes.value),
      details: logicRes,
      receipt: { ...receiptCore, receipt_sha256: sha256HexLower(stableJson(receiptCore)) },
    };
  }

  // 3. Offline Council Verification Check
  if (COUNCIL_VERIFICATION_RE.test(text)) {
    const councilResult = typeof councilVerifyFn === "function"
      ? councilVerifyFn(text)
      : { status: "routed_to_council_verifier", promotion_allowed: false, helper_role: "offline_verification_only" };
    const receiptCore = {
      schema_version: WORK_TYPE_RECEIPT_SCHEMA,
      timestamp: nowIso,
      work_type: "council_verification",
      selected_tier: "T0",
      execution_surface: "council_offline_verifier",
      llm_invoked: false,
      cost_usd: 0,
      input_sha256: sha256HexLower(text),
    };
    return {
      work_type: "council_verification",
      handled_deterministically: true,
      llm_invoked: false,
      answer: typeof councilResult === "string" ? councilResult : JSON.stringify(councilResult),
      details: councilResult,
      receipt: { ...receiptCore, receipt_sha256: sha256HexLower(stableJson(receiptCore)) },
    };
  }

  // 4. Natural Language -> Bounded Language Model
  const receiptCore = {
    schema_version: WORK_TYPE_RECEIPT_SCHEMA,
    timestamp: nowIso,
    work_type: "natural_language",
    selected_tier: "T1_OR_T2_LLM",
    execution_surface: "language_model_router",
    llm_invoked: true,
    cost_usd: null,
    input_sha256: sha256HexLower(text),
  };
  return {
    work_type: "natural_language",
    handled_deterministically: false,
    llm_invoked: true,
    answer: null,
    receipt: { ...receiptCore, receipt_sha256: sha256HexLower(stableJson(receiptCore)) },
  };
}

/**
 * Validates structured JSON output against required keys/types, retrying up to `maxRetries` (<= 3)
 * and recording every attempt in a hash-backed receipt (`Phase 3b`).
 */
export async function executeStructuredOutputWithRetry(invokeFn, schemaSpec = {}, {
  maxRetries = 2,
  now = () => new Date(),
} = {}) {
  const clampedRetries = Math.max(0, Math.min(3, Math.floor(Number(maxRetries) || 0)));
  const requiredFields = Array.isArray(schemaSpec.required) ? schemaSpec.required : [];
  const fieldTypes = schemaSpec.types && typeof schemaSpec.types === "object" ? schemaSpec.types : {};
  const retryErrors = [];
  let parsed = null;
  let succeeded = false;
  let attempts = 0;

  for (let attempt = 0; attempt <= clampedRetries; attempt += 1) {
    attempts += 1;
    const raw = await invokeFn({
      attempt,
      previous_error: retryErrors.length > 0 ? retryErrors[retryErrors.length - 1] : null,
    });

    let candidate;
    try {
      candidate = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (err) {
      retryErrors.push(`attempt_${attempt + 1}: invalid_json (${err.message})`);
      continue;
    }

    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      retryErrors.push(`attempt_${attempt + 1}: root_must_be_json_object`);
      continue;
    }

    const missing = requiredFields.filter((k) => !(k in candidate));
    if (missing.length > 0) {
      retryErrors.push(`attempt_${attempt + 1}: missing_required_fields:${missing.join(",")}`);
      continue;
    }

    const badTypes = [];
    for (const [k, expectedType] of Object.entries(fieldTypes)) {
      if (!(k in candidate)) continue;
      const val = candidate[k];
      const actualType = Array.isArray(val) ? "array" : typeof val;
      if (actualType !== expectedType) {
        badTypes.push(`${k}(expected ${expectedType}, got ${actualType})`);
      }
    }
    if (badTypes.length > 0) {
      retryErrors.push(`attempt_${attempt + 1}: type_mismatch:${badTypes.join(",")}`);
      continue;
    }

    parsed = candidate;
    succeeded = true;
    break;
  }

  const tsVal = typeof now === "function" ? now() : now;
  const timestamp = tsVal instanceof Date ? tsVal.toISOString() : new Date(tsVal || Date.now()).toISOString();
  const receiptCore = {
    schema_version: STRUCTURED_RETRY_RECEIPT_SCHEMA,
    timestamp,
    attempt_count: attempts,
    max_retries: clampedRetries,
    succeeded,
    retry_errors: retryErrors,
    output_sha256: succeeded ? sha256HexLower(stableJson(parsed)) : null,
  };

  return {
    ok: succeeded,
    data: parsed,
    attempt_count: attempts,
    retry_errors: retryErrors,
    receipt: {
      ...receiptCore,
      receipt_sha256: sha256HexLower(stableJson(receiptCore)),
    },
  };
}

/**
 * Executes an ordered provider fallback cascade when models/APIs are down (`Phase 3b`):
 *   stronger -> weaker -> local -> cache -> degraded_unavailable
 */
export async function executeOrderedFallbackCascade({
  candidates = [],
  invokeCandidate,
  cacheLookup = null,
  now = () => new Date(),
} = {}) {
  const rankOrder = { stronger: 0, weaker: 1, local: 2 };
  const ordered = [...candidates].sort(
    (a, b) => (rankOrder[a.tier_role] ?? 9) - (rankOrder[b.tier_role] ?? 9)
  );
  const attempts = [];

  for (const candidate of ordered) {
    try {
      const output = await invokeCandidate(candidate);
      attempts.push({
        route_id: candidate.route_id,
        tier_role: candidate.tier_role,
        status: "succeeded",
      });
      return _sealCascadeResult({
        ok: true,
        degraded: candidate.tier_role !== "stronger",
        selected_source: candidate.tier_role,
        selected_route_id: candidate.route_id,
        output,
        user_status_message: candidate.tier_role === "stronger"
          ? null
          : `Primary model unavailable; served via ${candidate.tier_role} fallback (${candidate.route_id}).`,
        attempts,
        now,
      });
    } catch (err) {
      attempts.push({
        route_id: candidate.route_id,
        tier_role: candidate.tier_role,
        status: "failed",
        reason: String(err?.code || err?.message || "provider_unavailable").slice(0, 120),
      });
    }
  }

  if (typeof cacheLookup === "function") {
    const cached = await cacheLookup();
    if (cached !== null && cached !== undefined) {
      attempts.push({ route_id: "zone_scoped_cache", tier_role: "cache", status: "succeeded" });
      return _sealCascadeResult({
        ok: true,
        degraded: true,
        selected_source: "cache",
        selected_route_id: "zone_scoped_cache",
        output: cached,
        user_status_message: "Live model providers are currently unavailable; showing verified zone-scoped cached result.",
        attempts,
        now,
      });
    }
  }

  return _sealCascadeResult({
    ok: false,
    degraded: true,
    selected_source: "degraded_unavailable",
    selected_route_id: null,
    output: null,
    user_status_message: "Model providers are currently offline or unreachable. Your state is preserved; retry when a local or hosted seat is available.",
    attempts,
    now,
  });
}

function _sealCascadeResult({
  ok,
  degraded,
  selected_source,
  selected_route_id,
  output,
  user_status_message,
  attempts,
  now,
}) {
  const tsVal = typeof now === "function" ? now() : now;
  const timestamp = tsVal instanceof Date ? tsVal.toISOString() : new Date(tsVal || Date.now()).toISOString();
  const receiptCore = {
    schema_version: FALLBACK_CASCADE_RECEIPT_SCHEMA,
    timestamp,
    ok,
    degraded,
    selected_source,
    selected_route_id,
    attempts,
  };
  return {
    ok,
    degraded,
    selected_source,
    selected_route_id,
    output,
    user_status_message,
    attempts,
    receipt: {
      ...receiptCore,
      receipt_sha256: sha256HexLower(stableJson(receiptCore)),
    },
  };
}
