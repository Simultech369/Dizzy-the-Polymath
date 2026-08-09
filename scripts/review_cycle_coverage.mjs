import fs from "fs";
import path from "path";
import { buildReviewCoverageReport } from "../lib/review_cycle_coverage.mjs";

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

const args = process.argv.slice(2);
const historyPath = argValue(args, "--history", "reviews/review_cycle_history.json");
const maxItems = Number(argValue(args, "--max", "8")) || 8;

const history = readJson(historyPath, {});
const packageJson = readJson("package.json", {});
const report = buildReviewCoverageReport({ history, packageJson, maxItems });

console.log(JSON.stringify(report, null, 2));
