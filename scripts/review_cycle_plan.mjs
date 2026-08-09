import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { buildReviewCyclePlan } from "../lib/review_cycle_orchestrator.mjs";

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8"));
  } catch {
    return fallback;
  }
}

function argValue(args, name, fallback = "") {
  const idx = args.indexOf(name);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return fallback;
}

function changedFilesFromGit(base, head) {
  const range = `${base}..${head}`;
  const result = spawnSync("git", ["diff", "--name-only", range], { encoding: "utf8", cwd: process.cwd() });
  if (result.status !== 0) {
    throw new Error(`git diff failed for ${range}: ${String(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function changedFilesFromWorktree() {
  const result = spawnSync("git", ["status", "--short", "--untracked-files=all"], { encoding: "utf8", cwd: process.cwd() });
  if (result.status !== 0) {
    throw new Error(`git status failed for working tree: ${String(result.stderr || result.stdout).trim()}`);
  }
  const files = [];
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const payload = line.slice(3).trim();
    if (!payload) continue;
    const renameParts = payload.split(" -> ");
    files.push(renameParts[renameParts.length - 1]);
  }
  return [...new Set(files)].sort();
}

const args = process.argv.slice(2);
const base = argValue(args, "--base", "HEAD~1");
const head = argValue(args, "--head", "HEAD");
const maxReviewers = Number(argValue(args, "--max-reviewers", "12")) || 12;
const maxHarnesses = Number(argValue(args, "--max-harnesses", "8")) || 8;
const candidateId = argValue(args, "--candidate-id", "");
const changedArg = argValue(args, "--changed", "");
const historyPath = argValue(args, "--history", "");
const useWorktree = args.includes("--worktree");

const changedFiles = changedArg
  ? changedArg.split(",").map((item) => item.trim()).filter(Boolean)
  : useWorktree
    ? changedFilesFromWorktree()
    : changedFilesFromGit(base, head);

const packageJson = readJson("package.json", {});
const history = historyPath ? readJson(historyPath, {}) : {};

const plan = buildReviewCyclePlan({
  changedFiles,
  packageJson,
  history,
  maxReviewers,
  maxHarnesses,
  candidateId,
});

console.log(JSON.stringify(plan, null, 2));
