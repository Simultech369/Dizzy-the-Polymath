import fs from "fs";
import path from "path";
import readline from "readline";

const statePath = path.resolve(process.cwd(), "state.json");

function main() {
  if (!fs.existsSync(statePath)) {
    console.error("state.json not found.");
    process.exit(1);
  }

  const raw = fs.readFileSync(statePath, "utf8");
  const state = JSON.parse(raw);
  const nodes = state.memory_nodes || [];
  const pending = nodes.filter((n) => n.status === "pending_purge");

  if (pending.length === 0) {
    console.log("No memory nodes pending purge.");
    process.exit(0);
  }

  console.log(`Found ${pending.length} memory nodes pending purge:\n`);
  pending.forEach((node, i) => {
    console.log(`[${i + 1}] ID: ${node.id}`);
    console.log(`    Content: ${node.content}`);
    console.log(`    Source: ${node.source}`);
    console.log(`    Sensitivity: ${node.sensitivity || "normal"}`);
    console.log(`    ExpiresAt: ${node.expiresAt}`);
    console.log("-----------------------------------------");
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Do you want to permanently delete these nodes? (y/N): ", (answer) => {
    rl.close();
    if (answer.trim().toLowerCase() === "y") {
      state.memory_nodes = nodes.filter((n) => n.status !== "pending_purge");
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
      console.log("Successfully purged pending memory nodes.");
    } else {
      console.log("Purge cancelled.");
    }
  });
}

main();
