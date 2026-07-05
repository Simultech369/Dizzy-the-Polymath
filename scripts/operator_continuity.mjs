#!/usr/bin/env node
import {
  buildContinuityReport,
  deleteClientContinuity,
  exportClientContinuity,
} from "../lib/client_continuity.mjs";

function usage() {
  return [
    "Usage:",
    "  node scripts/operator_continuity.mjs list [--json]",
    "  node scripts/operator_continuity.mjs export <conversation_key>",
    "  node scripts/operator_continuity.mjs delete <conversation_key>",
  ].join("\n");
}

function printHumanList(report) {
  console.log(`Client continuity records (${report.counts.records})`);
  console.log(`history=${report.history_path}`);
  console.log(`conversations=${report.conversation_dir}`);
  console.log(`retention_days=${report.expiry_days}`);
  if (!report.records.length) {
    console.log("No active client continuity records found.");
    return;
  }

  for (const record of report.records) {
    const expiry = record.expiry.expired
      ? "expired"
      : record.expiry.remaining_hours == null
        ? "unknown"
        : `${record.expiry.remaining_hours}h remaining`;
    console.log("");
    console.log(`- ${record.conversation_key}`);
    console.log(`  client_id: ${record.client_id || "unknown"}`);
    console.log(`  service_id: ${record.service_id || "unknown"}`);
    console.log(`  ownership_source: ${record.ownership_source}`);
    console.log(`  file: ${record.file.exists ? `${record.file.path} (${record.file.size_bytes} bytes, ${record.file.line_count} lines)` : "missing"}`);
    console.log(`  history_rows: ${record.history.rows}`);
    console.log(`  last_seen: ${record.history.last_seen_at || "unknown"}`);
    console.log(`  expiry: ${expiry} (${record.expiry.basis})`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  try {
    if (command === "help" || command === "--help" || command === "-h") {
      console.log(usage());
      return;
    }

    if (command === "list") {
      const report = buildContinuityReport();
      if (args.includes("--json")) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        printHumanList(report);
      }
      return;
    }

    if (command === "export") {
      const key = args[1] || "";
      if (!key) throw new Error("export requires <conversation_key>");
      const result = exportClientContinuity({ conversation_key: key });
      if (!result.ok) {
        console.error(result.error || "export failed");
        process.exitCode = 1;
        return;
      }
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === "delete") {
      const key = args[1] || "";
      if (!key) throw new Error("delete requires <conversation_key>");
      const result = deleteClientContinuity({ conversation_key: key, reason: "operator_cli_delete" });
      if (!result.ok) {
        console.error(result.error || "delete failed");
        process.exitCode = 1;
        return;
      }
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    throw new Error(`Unknown command: ${command}`);
  } catch (err) {
    console.error(String(err?.message || err));
    console.error("");
    console.error(usage());
    process.exitCode = 1;
  }
}

main();
