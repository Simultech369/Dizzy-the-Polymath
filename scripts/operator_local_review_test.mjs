import assert from "node:assert/strict";
import crypto from "node:crypto";

import { startServer } from "../agent_server.mjs";

console.log("=== Local Review Harness Operator API Test Suite ===");

const TOKEN = "local-review-test-token-0123456789";

function sha256(value) {
  return crypto.createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

function assertStatus(response, expected, label) {
  assert.equal(response.status, expected, `${label} returned ${response.status}; expected ${expected}`);
}

async function jsonPost(base, body, headers = {}) {
  const response = await fetch(`${base}/api/operator/local-review`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  return { response, json };
}

let executorMode = "success";
const executorCalls = [];
const runtime = await startServer({
  port: 0,
  bindHost: "127.0.0.1",
  dashboardEnabled: true,
  authToken: TOKEN,
  publicSurfaceMode: "closed",
  redisUrl: "",
  localReviewExecutor: async (input) => {
    executorCalls.push(input);
    if (executorMode === "skipped") {
      return {
        source: input.reviewer.role_key,
        role_key: input.reviewer.role_key,
        status: "skipped",
        skipped_reason: "local_review_backend_unavailable",
        findings: [],
      };
    }
    if (executorMode === "failed") {
      return {
        source: input.reviewer.role_key,
        role_key: input.reviewer.role_key,
        status: "failed",
        failure_stage: "parse",
        error: "model review response did not contain a JSON object",
        findings: [],
      };
    }
    return {
      source: input.reviewer.role_key,
      role_key: input.reviewer.role_key,
      status: "submitted",
      summary: "Supplied evidence reviewed.",
      findings: [
        {
          severity: "medium",
          category: "test_gap",
          claim: "The supplied change needs a regression test.",
          evidence: ["operator-supplied diff"],
          disposition: "new",
        },
      ],
      target: {
        backend: "openai_compat",
        model: input.reviewer.primary_model,
        base_url_host: "127.0.0.1:11434",
      },
    };
  },
});

try {
  const base = `http://127.0.0.1:${runtime.boundPort}`;

  {
    const { response, json } = await jsonPost(base, {
      selection: { seat_id: "unknown", harness_id: "dizzy_json_review" },
      supplied_text: "diff --git a/example b/example",
    });
    assertStatus(response, 400, "unknown local review seat");
    assert.equal(json.code, "LOCAL_REVIEW_SELECTION_REJECTED");
    assert.equal(json.reason, "unknown_review_seat");
  }

  {
    const { response, json } = await jsonPost(base, {
      selection: { seat_id: "qwen_local", harness_id: "native_chat" },
      supplied_text: "diff --git a/example b/example",
    });
    assertStatus(response, 400, "native chat harness rejected for review");
    assert.equal(json.reason, "harness_not_supported_for_local_review");
  }

  {
    const { response, json } = await jsonPost(base, {
      selection: { seat_id: "qwen_local", harness_id: "dizzy_json_review" },
      supplied_text: "",
    });
    assertStatus(response, 400, "empty supplied evidence");
    assert.equal(json.code, "LOCAL_REVIEW_TEXT_REQUIRED");
  }

  {
    const { response, json } = await jsonPost(base, {
      selection: { seat_id: "qwen_local", harness_id: "dizzy_json_review" },
      supplied_text: "x".repeat(64_001),
    });
    assertStatus(response, 413, "oversized supplied evidence");
    assert.equal(json.code, "LOCAL_REVIEW_TEXT_TOO_LARGE");
  }

  {
    const before = executorCalls.length;
    const { response, json } = await jsonPost(base, {
      selection: { seat_id: "qwen_local", harness_id: "dizzy_json_review" },
      file: "C:/Users/Josh/clawd/README.md",
      supplied_text: "review this file path please",
    });
    assertStatus(response, 400, "file path input rejected");
    assert.equal(json.code, "LOCAL_REVIEW_FILE_PATH_INPUT_REJECTED");
    assert.equal(executorCalls.length, before, "file path rejection must happen before model execution");
  }

  {
    executorMode = "success";
    const suppliedText = "diff --git a/dashboard.js b/dashboard.js\n+const ok = true;";
    const { response, json } = await jsonPost(base, {
      selection: {
        seat_id: "qwen_local",
        model_id: "qwen2.5-coder:7b",
        harness_id: "dizzy_json_review",
      },
      subject: "review harness smoke",
      review_goal: "Find concrete issues only.",
      supplied_text: suppliedText,
    });
    assertStatus(response, 200, "successful mocked local review");
    assert.equal(json.ok, true);
    assert.equal(json.status, "submitted");
    assert.equal(json.authority, "ADVISORY_SUPPLIED_EVIDENCE_REVIEW_ONLY");
    assert.equal(json.findings.length, 1);
    assert.equal(json.receipt.input_sha256, sha256(suppliedText));
    assert.match(json.receipt.output_sha256, /^[a-f0-9]{64}$/);
    assert.equal(json.receipt.seat_id, "qwen_local");
    assert.equal(json.receipt.model_id, "qwen2.5-coder:7b");
    assert.equal(json.receipt.harness_id, "dizzy_json_review");
    assert.equal(json.receipt.input_chars, suppliedText.length);
    assert.equal(json.receipt.reviewed_chars, suppliedText.length);
    assert.equal(json.receipt.omitted_chars, 0);
    assert.equal(json.receipt.input_truncated, false);
    assert.equal(json.receipt.file_reads_observed, false);
    assert.equal(json.receipt.edits_observed, false);
    assert.equal(json.receipt.tests_observed, false);
    assert.equal(json.receipt.promotion_authority, false);
    assert.equal(executorCalls.at(-1).diffText, suppliedText);
    assert.equal(executorCalls.at(-1).allowCloud, false);
    assert.equal(executorCalls.at(-1).trustZone, "private_self");
    assert.equal(executorCalls.at(-1).maxDiffChars, suppliedText.length);
    assert.equal(executorCalls.at(-1).reviewer.execution_target.model, "qwen2.5-coder:7b");
    assert.equal(executorCalls.at(-1).reviewer.execution_target.baseUrl, "http://127.0.0.1:11434/v1");
  }

  {
    executorMode = "success";
    const suppliedText = 'token="abc"suffix';
    const reviewedText = "token=[REDACTED]suffix";
    const { response, json } = await jsonPost(base, {
      selection: { seat_id: "qwen_local", harness_id: "dizzy_json_review" },
      supplied_text: suppliedText,
    });
    assertStatus(response, 200, "redacted supplied text remains packet-accounted");
    assert.equal(json.status, "submitted");
    assert.equal(executorCalls.at(-1).diffText, reviewedText);
    assert.equal(executorCalls.at(-1).maxDiffChars, reviewedText.length);
    assert.equal(json.receipt.input_chars, suppliedText.length);
    assert.equal(json.receipt.submitted_chars, suppliedText.length);
    assert.equal(json.receipt.redacted_chars, reviewedText.length);
    assert.equal(json.receipt.reviewed_chars, reviewedText.length);
    assert.equal(json.receipt.omitted_chars, 0);
    assert.equal(json.receipt.input_truncated, false);
    assert.equal(json.receipt.omitted_reason, "none");
  }

  {
    const before = executorCalls.length;
    const expandingSecretInput = "sk-12345678 ".repeat(3800);
    const { response, json } = await jsonPost(base, {
      selection: { seat_id: "qwen_local", harness_id: "dizzy_json_review" },
      supplied_text: expandingSecretInput,
    });
    assertStatus(response, 413, "redacted local review input rejected when it exceeds the review bound");
    assert.equal(json.code, "LOCAL_REVIEW_REDACTED_TEXT_TOO_LARGE");
    assert.equal(executorCalls.length, before, "redacted oversize rejection must happen before model execution");
  }

  {
    const { response, json } = await jsonPost(base, {
      selection: { seat_id: "mistral_local", model_id: "qwen2.5-coder:7b", harness_id: "dizzy_json_review" },
      supplied_text: "small diff",
    });
    assertStatus(response, 400, "conflicting review seat/model rejected");
    assert.equal(json.reason, "seat_model_mismatch");
  }

  {
    executorMode = "skipped";
    const { response, json } = await jsonPost(base, {
      selection: { seat_id: "qwen_local", harness_id: "dizzy_json_review" },
      supplied_text: "small diff",
    });
    assertStatus(response, 200, "offline local review skipped");
    assert.equal(json.ok, false);
    assert.equal(json.status, "skipped");
    assert.equal(json.skipped_reason, "local_review_backend_unavailable");
    assert.equal(json.receipt.cloud_fallback_allowed, false);
    assert.equal(json.receipt.file_reads_observed, false);
    assert.equal(json.receipt.reviewed_chars, 0);
    assert.equal(json.receipt.omitted_chars, "small diff".length);
    assert.equal(json.receipt.input_truncated, false);
    assert.equal(json.receipt.omitted_reason, "not_reviewed_backend_skipped");
  }

  {
    executorMode = "failed";
    const { response, json } = await jsonPost(base, {
      selection: { seat_id: "qwen_local", harness_id: "dizzy_json_review" },
      supplied_text: "small diff",
    });
    assertStatus(response, 502, "failed local review parse");
    assert.equal(json.ok, false);
    assert.equal(json.status, "failed");
    assert.equal(json.receipt.model_output_authority, "claims_only");
    assert.equal(json.receipt.promotion_authority, false);
    assert.equal(json.receipt.reviewed_chars, 0);
    assert.equal(json.receipt.omitted_chars, "small diff".length);
    assert.equal(json.receipt.omitted_reason, "not_reviewed_backend_failed");
  }
} finally {
  await new Promise((resolve) => runtime.server.close(resolve));
}

console.log("OPERATOR_LOCAL_REVIEW_TESTS_OK");
