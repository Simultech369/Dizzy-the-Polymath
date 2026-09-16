import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const TEST_INCIDENT = path.join(process.cwd(), "test_incident.json");
const FIXTURES_PATH = path.join(process.cwd(), "scripts/fixtures/trajectory_eval_fixtures.json");

try {
  console.log("[test:mine-incident] Starting suite...");
  
  // Backup fixtures
  const fixturesBackup = fs.readFileSync(FIXTURES_PATH, "utf8");

  const incident = {
    steps: [
      { actor: "user", content: "Contact admin@example.com." },
      { actor: "agent", tool: "send_email", result: "Sent using sk-1234567890abcdef1234567890abcdef" }
    ]
  };

  fs.writeFileSync(TEST_INCIDENT, JSON.stringify(incident), "utf8");

  execSync("node scripts/mine_incident.mjs test_incident.json test_incident_fixture FAILED", { stdio: "inherit" });

  const updatedFixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, "utf8"));
  const mined = updatedFixtures.trajectories.find(t => t.id === "test_incident_fixture");
  
  assert.ok(mined);
  assert.equal(mined.expected_status, "FAILED");
  assert.equal(mined.steps.length, 2);
  
  // Verify redaction
  assert.ok(mined.steps[0].content.includes("[REDACTED_EMAIL]"));
  assert.ok(!mined.steps[0].content.includes("admin@example.com"));
  assert.ok(mined.steps[1].result.includes("[REDACTED_KEY]"));

  console.log("  [PASS] Incident successfully mined, formatted, and redacted into fixture.");

  // Restore fixtures
  fs.writeFileSync(FIXTURES_PATH, fixturesBackup, "utf8");

  console.log("\n[test:mine-incident] ALL TESTS PASSED CLEANLY.\n");

} finally {
  if (fs.existsSync(TEST_INCIDENT)) fs.unlinkSync(TEST_INCIDENT);
}
