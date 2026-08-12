import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getRelevantMarkdownSnippets } from "../lib/md_retriever.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

/**
 * W-0065b: Golden Retrieval Evaluation Harness
 * 20 Golden Queries testing md_retriever.mjs retrieval quality,
 * Hit Rate @ 1, Hit Rate @ 3, and Mean Reciprocal Rank (MRR).
 */

const GOLDEN_DATASET = [
  {
    query: "anti-extraction without anti-market",
    expectedHits: ["SOUL.md", "USER.md", "PROMPT_CORE.md"],
  },
  {
    query: "preventative economics",
    expectedHits: ["PROMPT_CORE.md", "SOUL.md"],
  },
  {
    query: "trust zone boundaries private self paid public",
    expectedHits: ["PROMPT_CORE.md", "TOOLS.md"],
  },
  {
    query: "Ralph loop detector",
    expectedHits: ["SOUL.md"],
  },
  {
    query: "subsidiarity smallest competent scale",
    expectedHits: ["SOUL.md", "USER.md"],
  },
  {
    query: "fiduciary surplus routing",
    expectedHits: ["PROMPT_CORE.md"],
  },
  {
    query: "bounded sovereignty dissent protocol",
    expectedHits: ["IDENTITY.md"],
  },
  {
    query: "relevance half life decay factor 180 days",
    expectedHits: ["PROMPT_CORE.md", "NEXT.md"],
  },
  {
    query: "operator veto override consensus status",
    expectedHits: ["NEXT.md", "OPERATING_LOOP.md"],
  },
  {
    query: "chokepoint extraction positional goods",
    expectedHits: ["USER.md", "SOUL.md", "PROMPT_CORE.md"],
  },
  {
    query: "continuity and judgment runtime",
    expectedHits: ["PROMPT_CORE.md", "IDENTITY.md"],
  },
  {
    query: "image generation layout watermark safety protocol",
    expectedHits: ["TOOLS.md"],
  },
  {
    query: "Stein reality-testing protection convergence flag",
    expectedHits: ["SOUL.md"],
  },
  {
    query: "Landry optionality criterion closing question",
    expectedHits: ["SOUL.md"],
  },
  {
    query: "level 4 irreversible actions permission level",
    expectedHits: ["TOOLS.md"],
  },
  {
    query: "dizzy prompt core non-negotiable norms",
    expectedHits: ["PROMPT_CORE.md"],
  },
  {
    query: "work queue dynamic model routing W-0066",
    expectedHits: ["NEXT.md"],
  },
  {
    query: "anti-slop visual scanner experimental module",
    expectedHits: ["NEXT.md"],
  },
  {
    query: "human at the center Simul collaborator",
    expectedHits: ["USER.md"],
  },
  {
    query: "jazz surgeon clinical during risk",
    expectedHits: ["SOUL.md", "IDENTITY.md", "TOOLS.md"],
  },
];

function parseNumberArg(args, name, fallback) {
  const prefix = `${name}=`;
  const direct = args.find((arg) => arg.startsWith(prefix));
  const value = direct ? direct.slice(prefix.length) : "";
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function runRetrievalEval({
  writeReceipt = true,
  minHitRateTop3 = 75.0,
  minMrr = 0.60,
  logger = console,
} = {}) {
  logger.log("==================================================");
  logger.log("   W-0065b: Golden Retrieval Evaluation Harness   ");
  logger.log("==================================================\n");

  let hitCountTop1 = 0;
  let hitCountTop3 = 0;
  let reciprocalRankSum = 0;
  const evalDetails = [];

  for (const item of GOLDEN_DATASET) {
    const snippets = getRelevantMarkdownSnippets(item.query, { k: 5 });
    const returnedPaths = snippets.map((s) => s.path);

    // Find position of first matching expected hit
    let firstHitRank = 0;
    for (let i = 0; i < returnedPaths.length; i++) {
      const pathBasename = path.basename(returnedPaths[i]);
      if (item.expectedHits.some((exp) => exp === pathBasename || returnedPaths[i].endsWith(exp))) {
        firstHitRank = i + 1;
        break;
      }
    }

    const hitTop1 = firstHitRank === 1;
    const hitTop3 = firstHitRank > 0 && firstHitRank <= 3;
    const reciprocalRank = firstHitRank > 0 ? 1 / firstHitRank : 0;

    if (hitTop1) hitCountTop1++;
    if (hitTop3) hitCountTop3++;
    reciprocalRankSum += reciprocalRank;

    evalDetails.push({
      query: item.query,
      expected: item.expectedHits,
      returned: returnedPaths.slice(0, 3),
      firstHitRank,
      reciprocalRank,
    });

    const statusSymbol = hitTop3 ? "\x1b[32m[PASS]\x1b[0m" : "\x1b[31m[MISS]\x1b[0m";
    logger.log(`${statusSymbol} Q: "${item.query}" -> First hit rank: ${firstHitRank ? `#${firstHitRank}` : "NONE"}`);
  }

  const total = GOLDEN_DATASET.length;
  const hitRateTop1 = (hitCountTop1 / total) * 100;
  const hitRateTop3 = (hitCountTop3 / total) * 100;
  const mrr = reciprocalRankSum / total;

  logger.log("\n--------------------------------------------------");
  logger.log(` Hit Rate @ 1 : ${hitRateTop1.toFixed(1)}% (${hitCountTop1}/${total})`);
  logger.log(` Hit Rate @ 3 : ${hitRateTop3.toFixed(1)}% (${hitCountTop3}/${total})`);
  logger.log(` Mean Reciprocal Rank (MRR) : ${mrr.toFixed(3)}`);
  logger.log("--------------------------------------------------\n");

  const receipt = {
    schema: "dizzy.retrieval_eval_receipt.v1",
    timestamp: new Date().toISOString(),
    totalQueries: total,
    metrics: {
      hit_rate_top_1_pct: Number(hitRateTop1.toFixed(1)),
      hit_rate_top_3_pct: Number(hitRateTop3.toFixed(1)),
      mrr: Number(mrr.toFixed(3)),
    },
    evalDetails,
  };

  let receiptPath = "";
  if (writeReceipt) {
    const reviewsDir = path.join(ROOT_DIR, "reviews");
    if (!fs.existsSync(reviewsDir)) {
      fs.mkdirSync(reviewsDir, { recursive: true });
    }
    receiptPath = path.join(reviewsDir, "retrieval_eval_latest.json");
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
    logger.log(`Saved evaluation receipt to: ${receiptPath}`);
  }

  const ok = hitRateTop3 >= minHitRateTop3 && mrr >= minMrr;
  if (!ok) {
    logger.error(`\x1b[31m[FAIL] Retrieval quality below threshold (HitRate@3 >= ${minHitRateTop3}%, MRR >= ${minMrr.toFixed(2)} required)\x1b[0m`);
  } else {
    logger.log(`\x1b[32m[SUCCESS] Retrieval evaluation passed quality threshold!\x1b[0m\n`);
  }

  return {
    ok,
    receipt,
    receiptPath,
    thresholds: {
      hit_rate_top_3_pct: minHitRateTop3,
      mrr: minMrr,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith("retrieval_eval.mjs")) {
  const args = process.argv.slice(2);
  const result = runRetrievalEval({
    writeReceipt: !args.includes("--no-write"),
    minHitRateTop3: parseNumberArg(args, "--min-hit-rate-top-3", 75.0),
    minMrr: parseNumberArg(args, "--min-mrr", 0.60),
  });
  process.exit(result.ok ? 0 : 1);
}
