import assert from "node:assert/strict";
import {
  buildGitBindingDigest,
  collectGitBinding,
  createAuditResults,
} from "./oss_council_audit.mjs";

console.log("=== W-0139 Council Receipt Git Binding Test Suite ===");

const binding = collectGitBinding(process.cwd());

assert.equal(binding.schema_version, "dizzy.git_binding.v1");
assert.match(binding.head_commit, /^([0-9a-f]{40}|unknown)$/);
assert.equal(typeof binding.branch, "string");
assert.equal(typeof binding.is_dirty, "boolean");
assert(Array.isArray(binding.status_short), "status_short must be a stable array");
assert.match(binding.binding_sha256, /^[0-9a-f]{64}$/);
assert.equal(binding.binding_sha256, buildGitBindingDigest(binding));

const changedBinding = {
  ...binding,
  is_dirty: !binding.is_dirty,
};
assert.notEqual(
  buildGitBindingDigest(changedBinding),
  binding.binding_sha256,
  "dirty-tree status must change the Git binding digest",
);

const receipt = createAuditResults({
  now: new Date("2026-09-14T00:00:00.000Z"),
  rootDir: process.cwd(),
});

assert.equal(receipt.timestamp, "2026-09-14T00:00:00.000Z");
assert.equal(receipt.verdict, "REJECTED");
assert.equal(receipt.git_binding.schema_version, "dizzy.git_binding.v1");
assert.equal(receipt.git_binding.binding_sha256, buildGitBindingDigest(receipt.git_binding));

console.log("COUNCIL_RECEIPT_GIT_BINDING_TESTS_OK");
