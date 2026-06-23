import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function value(flag, fallback) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : fallback;
}

function positiveInteger(flag, fallback) {
  const parsed = Number.parseInt(value(flag, String(fallback)), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer`);
  return parsed;
}

function resolveBenchmarkRoot() {
  const candidates = [
    process.env.DACR_BENCH_ROOT,
    path.join(os.homedir(), "Documents", "misc", "dacr-bench"),
    path.resolve(repoRoot, "..", "dacr-bench"),
  ].filter(Boolean);
  const root = candidates.find((candidate) => fs.existsSync(path.join(candidate, "package.json")));
  if (!root) {
    throw new Error("DACR-Bench not found. Set DACR_BENCH_ROOT to its checkout directory.");
  }
  return path.resolve(root);
}

function assertLocalEndpoint(endpoint) {
  const url = new URL(endpoint);
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error("DACR evaluation is local-only; endpoint must use localhost, 127.0.0.1, or ::1");
  }
}

async function preflightOllama(endpoint, model) {
  if (!/\/api\/chat\/?$/.test(endpoint)) return;
  const tagsUrl = new URL("/api/tags", endpoint);
  let response;
  try {
    response = await fetch(tagsUrl, { signal: AbortSignal.timeout(5000) });
  } catch (error) {
    throw new Error(`Ollama preflight failed at ${tagsUrl}: ${error?.message || error}`);
  }
  if (!response.ok) throw new Error(`Ollama preflight returned HTTP ${response.status}`);
  const body = await response.json();
  const installed = Array.isArray(body?.models) ? body.models.map((entry) => String(entry?.name || entry?.model || "")) : [];
  if (!installed.includes(model)) throw new Error(`Ollama model is not installed: ${model}`);
}

function assertUsableEvaluation(predictionsPath, reportPath) {
  const predictionRows = JSON.parse(fs.readFileSync(predictionsPath, "utf8"));
  if (!Array.isArray(predictionRows) || predictionRows.length === 0) {
    throw new Error("DACR runner produced no prediction rows");
  }
  const failedRows = predictionRows.filter((row) => {
    const metadata = row?.metadata || {};
    return Boolean(metadata.failureReason) || Number(metadata.formatFailures || 0) > 0 || metadata.parseFormat === "failed";
  });
  const reportBody = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  if (failedRows.length > 0 || Number(reportBody?.summary?.formatFailureRate || 0) > 0) {
    const reasons = failedRows.map((row) => row?.metadata?.failureReason || "format failure").join("; ");
    throw new Error(`DACR evaluation was not executable: ${reasons || "format failure reported"}`);
  }
}

function run(command, commandArgs, cwd, dryRun) {
  if (dryRun) return;
  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: "utf8",
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
}

const benchmarkRoot = resolveBenchmarkRoot();
const endpoint = value("--endpoint", "http://localhost:11434/api/chat");
assertLocalEndpoint(endpoint);

const model = value("--model", "gemma3:4b");
if (!/^[a-zA-Z0-9._:/-]+$/.test(model)) throw new Error("invalid model identifier");

const split = value("--split", "synthetic");
if (!["real", "synthetic", "all"].includes(split)) throw new Error("--split must be real, synthetic, or all");

const maxDocumentWords = positiveInteger("--max-document-words", 1800);
const limit = positiveInteger("--limit", 1);
const questions = positiveInteger("--questions", 1);
const maxTokens = positiveInteger("--max-tokens", 512);
const context = positiveInteger("--context", 8192);
const timeout = positiveInteger("--timeout", 600);
const dryRun = args.includes("--dry-run");

const safeModel = model.replace(/[^a-zA-Z0-9._-]+/g, "_");
const resultsDir = path.join(repoRoot, "evaluations", "dacr", "results");
const predictions = path.join(resultsDir, `predictions_${safeModel}_smoke.json`);
const report = path.join(resultsDir, `report_${safeModel}_smoke.json`);
const benchmark = path.join("data", "dacr_bench_v1.1_mini.json");
const tsxCli = path.join(benchmarkRoot, "node_modules", "tsx", "dist", "cli.mjs");
if (!fs.existsSync(tsxCli)) {
  throw new Error("DACR-Bench dependencies are missing. Run npm install in DACR_BENCH_ROOT.");
}

const sharedFilters = [
  "--split", split,
  "--max-document-words", String(maxDocumentWords),
  "--limit", String(limit),
  "--questions", String(questions),
];
const runArgs = [
  tsxCli, path.join(benchmarkRoot, "src", "run.ts"),
  "--benchmark", benchmark,
  "--runner", "http",
  "--endpoint", endpoint,
  "--model", model,
  ...sharedFilters,
  "--max-tokens", String(maxTokens),
  "--ollama-context", String(context),
  "--timeout", String(timeout),
  "--output", predictions,
];
const evaluateArgs = [
  tsxCli, path.join(benchmarkRoot, "src", "evaluate.ts"),
  "--benchmark", benchmark,
  "--predictions", predictions,
  ...sharedFilters,
  "--output", report,
];

const plan = {
  mode: "operator-run-local-evaluation",
  benchmark_root: benchmarkRoot,
  model,
  endpoint,
  context,
  predictions,
  report,
  commands: [
    { command: process.execPath, args: runArgs },
    { command: process.execPath, args: evaluateArgs },
  ],
};
console.log(JSON.stringify(plan, null, 2));

if (!dryRun) fs.mkdirSync(resultsDir, { recursive: true });
if (!dryRun) await preflightOllama(endpoint, model);
run(process.execPath, runArgs, benchmarkRoot, dryRun);
run(process.execPath, evaluateArgs, benchmarkRoot, dryRun);
if (!dryRun) assertUsableEvaluation(predictions, report);

if (!dryRun) console.log(`DACR report: ${report.replace(/\.json$/, ".md")}`);
