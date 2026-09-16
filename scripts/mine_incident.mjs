import fs from "node:fs";
import path from "node:path";

const FIXTURES_PATH = path.join(process.cwd(), "scripts/fixtures/trajectory_eval_fixtures.json");

function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error("Usage: node scripts/mine_incident.mjs <incident_json_path> <fixture_id> <expected_status>");
    process.exit(1);
  }

  const [incidentPath, fixtureId, expectedStatus] = args;
  
  const absIncident = path.resolve(process.cwd(), incidentPath);
  if (!fs.existsSync(absIncident)) {
    console.error(`Error: Incident file not found at ${absIncident}`);
    process.exit(1);
  }

  let incidentData;
  try {
    incidentData = JSON.parse(fs.readFileSync(absIncident, "utf8"));
  } catch (err) {
    console.error(`Error parsing incident JSON: ${err.message}`);
    process.exit(1);
  }

  // Expecting incidentData to be an array of steps or an object with a steps array
  const steps = Array.isArray(incidentData) ? incidentData : incidentData.steps;
  if (!steps || !Array.isArray(steps)) {
    console.error("Error: Incident JSON must contain a 'steps' array or be an array of steps.");
    process.exit(1);
  }

  let fixtures;
  try {
    fixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, "utf8"));
  } catch (err) {
    console.error(`Error reading fixtures file: ${err.message}`);
    process.exit(1);
  }

  // Check if ID already exists
  if (fixtures.trajectories.some(t => t.id === fixtureId)) {
    console.error(`Error: Fixture ID '${fixtureId}' already exists.`);
    process.exit(1);
  }

  // Sanitize steps (basic redaction of obvious PII/secrets)
  const sanitizedSteps = steps.map(step => {
    let stepStr = JSON.stringify(step);
    // Simple naive redact for demo
    stepStr = stepStr.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, "[REDACTED_EMAIL]");
    stepStr = stepStr.replace(/(sk-[a-zA-Z0-9]{20,})/g, "[REDACTED_KEY]");
    return JSON.parse(stepStr);
  });

  const newFixture = {
    id: fixtureId,
    expected_status: expectedStatus,
    steps: sanitizedSteps
  };

  fixtures.trajectories.push(newFixture);

  fs.writeFileSync(FIXTURES_PATH, JSON.stringify(fixtures, null, 2), "utf8");
  console.log(`Successfully mined incident '${fixtureId}' to fixtures (Status: ${expectedStatus}, Steps: ${steps.length}).`);
}

main();
