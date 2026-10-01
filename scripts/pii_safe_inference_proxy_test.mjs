import assert from "node:assert/strict";
import {
  PiiSafeInferenceProxy,
  verifyPiiInferenceProxyReceipt,
  PII_INFERENCE_PROXY_RECEIPT_SCHEMA,
} from "../lib/pii_safe_inference_proxy.mjs";

console.log("[PII_INFERENCE_PROXY_TEST] Starting test suite...");

const proxy = new PiiSafeInferenceProxy({
  now: () => new Date("2026-10-01T12:00:00.000Z"),
});

// Test 1: Reversible masking and unmasking on string prompt
{
  const rawPrompt =
    "Hello, user alice@example.com with wallet 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 reported an error at C:\\Users\\Josh\\clawd\\secret.txt with key sk-abcdef12345678901234567890 and IP 192.168.1.150.";

  const { maskedInput, session } = proxy.maskPrompt(rawPrompt);

  // Verify outbound prompt contains zero raw PII
  assert.doesNotMatch(maskedInput, /alice@example\.com/);
  assert.doesNotMatch(maskedInput, /0x70997970C51812dc3A010C7d01b50e0d17dc79C8/);
  assert.doesNotMatch(maskedInput, /C:\\Users\\Josh/);
  assert.doesNotMatch(maskedInput, /sk-abcdef12345678901234567890/);
  assert.doesNotMatch(maskedInput, /192\.168\.1\.150/);

  // Verify surrogate tokens are present
  assert.match(maskedInput, /\{\{SURROGATE_EMAIL_1\}\}/);
  assert.match(maskedInput, /\{\{SURROGATE_ETH_ADDRESS_1\}\}/);
  assert.match(maskedInput, /\{\{SURROGATE_LOCAL_PATH_1\}\}/);
  assert.match(maskedInput, /\{\{SURROGATE_SECRET_KEY_1\}\}/);
  assert.match(maskedInput, /\{\{SURROGATE_IP_ADDRESS_1\}\}/);

  // Simulate LLM response referencing the surrogate tokens
  const mockLlmResponse =
    "Confirmed. I investigated {{SURROGATE_LOCAL_PATH_1}} for account {{SURROGATE_ETH_ADDRESS_1}} ({{SURROGATE_EMAIL_1}}).";

  const unmasked = proxy.unmaskResponse(mockLlmResponse, session);

  assert.match(unmasked, /C:\\Users\\Josh\\clawd\\secret\.txt/);
  assert.match(unmasked, /0x70997970C51812dc3A010C7d01b50e0d17dc79C8/);
  assert.match(unmasked, /alice@example\.com/);
  assert.doesNotMatch(unmasked, /\{\{SURROGATE_/);

  console.log("  [PASS] Test 1: Reversible PII masking & unmasking verified");
}

// Test 2: Co-reference preservation (same entity gets same surrogate token)
{
  const text =
    "Contact bob@test.org first. If bob@test.org does not answer, then bob@test.org is offline.";

  const { maskedInput, session } = proxy.maskPrompt(text);

  assert.equal(session.categoryCounts.EMAIL, 1, "Only one unique email category count");
  assert.equal(session.totalEntitiesMasked, 3, "Three entity occurrences masked");
  assert.equal(session.tokenToOriginal.size, 1, "One unique mapping entry");

  // All 3 occurrences must map to {{SURROGATE_EMAIL_1}}
  const occurrences = maskedInput.match(/\{\{SURROGATE_EMAIL_1\}\}/g);
  assert.equal(occurrences.length, 3);
  assert.doesNotMatch(maskedInput, /bob@test\.org/);

  const restored = proxy.unmaskResponse(maskedInput, session);
  assert.equal(restored, text, "Full round-trip must restore identical text");

  console.log("  [PASS] Test 2: Co-reference preservation across multiple occurrences verified");
}

// Test 3: Structured message array masking
{
  const messages = [
    { role: "system", content: "You are an assistant with server IP 10.0.0.1." },
    { role: "user", content: "My recovery email is recovery@domain.com." },
  ];

  const { maskedInput, session } = proxy.maskPrompt(messages);

  assert.equal(maskedInput.length, 2);
  assert.match(maskedInput[0].content, /\{\{SURROGATE_IP_ADDRESS_1\}\}/);
  assert.match(maskedInput[1].content, /\{\{SURROGATE_EMAIL_1\}\}/);
  assert.doesNotMatch(maskedInput[0].content, /10\.0\.0\.1/);
  assert.doesNotMatch(maskedInput[1].content, /recovery@domain\.com/);

  console.log("  [PASS] Test 3: Structured message array masking verified");
}

// Test 4: Deep object unmasking
{
  const rawPrompt = "Transfer from 0x90F79bf6EB2c4f870365E785982E1f101E93b906";
  const { session } = proxy.maskPrompt(rawPrompt);

  const structuredLlmResponse = {
    id: "chatcmpl-123",
    choices: [
      {
        message: {
          role: "assistant",
          content: "Successfully prepared tx for {{SURROGATE_ETH_ADDRESS_1}}.",
        },
      },
    ],
  };

  const unmaskedObj = proxy.unmaskResponse(structuredLlmResponse, session);
  assert.equal(
    unmaskedObj.choices[0].message.content,
    "Successfully prepared tx for 0x90F79bf6EB2c4f870365E785982E1f101E93b906."
  );

  console.log("  [PASS] Test 4: Deep object unmasking verified");
}

// Test 5: Cryptographic receipt generation and verification
{
  const prompt = "Notify dev@example.com";
  const { maskedInput, session } = proxy.maskPrompt(prompt);
  const response = "Done notifying {{SURROGATE_EMAIL_1}}.";
  const unmaskedResponse = proxy.unmaskResponse(response, session);

  const receipt = proxy.generateReceipt({
    session,
    maskedInput,
    unmaskedResponse,
    provider: "openrouter/free",
  });

  assert.equal(receipt.schema_version, PII_INFERENCE_PROXY_RECEIPT_SCHEMA);
  assert.equal(receipt.entities_masked_count, 1);
  assert.equal(receipt.unique_entities_count, 1);
  assert.equal(receipt.zero_raw_pii_egress, true);
  assert.equal(verifyPiiInferenceProxyReceipt(receipt), true);

  // Tamper detection
  const tampered1 = { ...receipt, entities_masked_count: 99 };
  assert.equal(verifyPiiInferenceProxyReceipt(tampered1), false);

  const tampered2 = { ...receipt, evidence_sha256: "0".repeat(64) };
  assert.equal(verifyPiiInferenceProxyReceipt(tampered2), false);

  console.log("  [PASS] Test 5: Cryptographic receipt verification and tamper resistance verified");
}

console.log("[PII_INFERENCE_PROXY_TEST] All 5 tests passed successfully.");
