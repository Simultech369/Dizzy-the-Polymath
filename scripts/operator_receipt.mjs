import crypto from "crypto";
import fs from "fs";
import path from "path";

function readLastJsonl(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Receipt history not found: ${filePath}`);
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error(`Receipt history is empty: ${filePath}`);
  return JSON.parse(lines[lines.length - 1]);
}

function argValue(name, fallback = "") {
  const prefix = `${name}=`;
  const found = process.argv.slice(2).find((arg) => arg === name || arg.startsWith(prefix));
  if (!found) return fallback;
  if (found === name) return "1";
  return found.slice(prefix.length);
}

function relativePath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return path.isAbsolute(raw) ? path.relative(process.cwd(), raw).replace(/\\/g, "/") : raw.replace(/\\/g, "/");
}

function pathId(value) {
  return crypto.createHash("sha256").update(relativePath(value)).digest("hex").slice(0, 16);
}

function summarizeFiles(files, mode) {
  const clean = [...new Set((Array.isArray(files) ? files : []).map(String).filter(Boolean))].sort();
  if (mode === "private") return { count: clean.length, paths: clean.map(relativePath) };
  return { count: clean.length, ids: clean.map(pathId) };
}

function summarizeReceipt(row, mode) {
  const receipt = row.capability_receipt && typeof row.capability_receipt === "object" ? row.capability_receipt : {};
  const retrievedFiles = Array.isArray(receipt.retrieved_files) ? receipt.retrieved_files : [];
  const ragFiles = Array.isArray(receipt.retrieval_audit?.rag?.files) ? receipt.retrieval_audit.rag.files : [];
  const graphFiles = Array.isArray(receipt.retrieval_audit?.memory_graph?.files) ? receipt.retrieval_audit.memory_graph.files : [];
  return {
    t: row.t || "",
    route: row.route || "",
    trust_zone: row.trust_zone || receipt.trust_zone || "",
    continuity_mode: row.continuity_mode || receipt.continuity_mode || "",
    retention_scope: row.retention_scope || receipt.retention_scope || "",
    capabilities: {
      repo_retrieval_allowed: Boolean(row.repo_retrieval_allowed ?? receipt.repo_retrieval_allowed),
      durable_memory_allowed: Boolean(row.durable_memory_allowed ?? receipt.durable_memory_allowed),
      private_memory_access: Boolean(receipt.private_memory_access),
    },
    skills: {
      loaded: Array.isArray(receipt.skills?.loaded) ? receipt.skills.loaded.map(String).filter(Boolean) : [],
      manifests: Array.isArray(receipt.skills?.manifests) ? receipt.skills.manifests : [],
      rejected_count: Array.isArray(receipt.skills?.rejected) ? receipt.skills.rejected.length : 0,
    },
    retrieval: {
      all: summarizeFiles(retrievedFiles, mode),
      rag: summarizeFiles(ragFiles, mode),
      memory_graph: summarizeFiles(graphFiles, mode),
      trajectories: {
        count: Number(receipt.retrieval_audit?.trajectories?.count ?? 0) || 0,
        ids: Array.isArray(receipt.retrieval_audit?.trajectories?.ids) ? receipt.retrieval_audit.trajectories.ids.map(String).filter(Boolean).sort() : [],
      },
    },
    boundary_crossing: receipt.boundary_crossing || null,
    blocked_context: Array.isArray(receipt.blocked_context) ? receipt.blocked_context.map(String).filter(Boolean).sort() : [],
  };
}

const historyPath = path.resolve(process.cwd(), argValue("--history", process.env.DIZZY_EXECUTION_HISTORY_PATH || "runtime/execution_history.jsonl"));
const row = readLastJsonl(historyPath);
const explicitMode = process.argv.includes("--private") ? "private" : process.argv.includes("--public") ? "public" : "";
const envMode = String(process.env.DIZZY_OPERATOR_RECEIPT_MODE || "").trim().toLowerCase();
const receipt = row.capability_receipt || {};
const mode = explicitMode || (["private", "public"].includes(envMode) ? envMode : receipt.trust_zone === "private_self" ? "private" : "public");

console.log(JSON.stringify({
  mode,
  history: mode === "private" ? relativePath(historyPath) : pathId(historyPath),
  latest: summarizeReceipt(row, mode),
}, null, 2));
