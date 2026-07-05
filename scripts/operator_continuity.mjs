#!/usr/bin/env node
import {
  buildContinuityAudit,
  buildContinuityReport,
  deleteClientContinuity,
  exportClientContinuity,
} from "../lib/client_continuity.mjs";

function usage() {
  return [
    "Usage:",
    "  node scripts/operator_continuity.mjs list [--json]",
    "  node scripts/operator_continuity.mjs export <conversation_key>",
    "  node scripts/operator_continuity.mjs audit <conversation_key> [--json]",
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

function printHumanAudit(audit) {
  console.log(`Continuity audit: ${audit.conversation_key}`);
  console.log(`history_rows=${audit.counts.history_rows} conversation_rows=${audit.counts.conversation_rows}`);
  console.log(`trust_zones=${audit.boundary.trust_zones.join(", ") || "none"}`);
  console.log(`retention_scopes=${audit.boundary.retention_scopes.join(", ") || "none"}`);
  console.log(`blocked_context=${audit.boundary.blocked_context.join(", ") || "none"}`);
  console.log(`retrieved_files=${audit.counts.retrieved_files} filtered_files=${audit.counts.filtered_files}`);
  console.log(`loaded_skills=${audit.skills.loaded.join(", ") || "none"}`);

  if (audit.retrieval.filtered_files.length) {
    console.log("");
    console.log("Filtered retrieval decisions:");
    for (const item of audit.retrieval.filtered_files) {
      console.log(`- ${item.path} (${item.reason}${item.details ? `; ${item.details}` : ""})`);
    }
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

    if (command === "audit") {
      const key = args[1] || "";
      if (!key) throw new Error("audit requires <conversation_key>");
      const result = buildContinuityAudit({ conversation_key: key });
      if (!result.ok) {
        console.error(result.error || "audit failed");
        process.exitCode = 1;
        return;
      }
      if (args.includes("--json")) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printHumanAudit(result);
      }
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
