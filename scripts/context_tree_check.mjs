import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

function getLiveHeadSha() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  return result.status === 0 ? String(result.stdout || "").trim() : "";
}

function gitCommitExists(sha) {
  const result = spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], { encoding: "utf8" });
  return result.status === 0;
}

function gitCommitIsAncestor(ancestor, descendant) {
  const result = spawnSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], { encoding: "utf8" });
  return result.status === 0;
}

function lineCount(filePath) {
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/).length;
}

function runCheck() {
  const treePath = path.resolve(process.cwd(), "context-tree.json");
  if (!fs.existsSync(treePath)) {
    console.error("[FAIL] context-tree.json missing");
    process.exit(1);
  }

  let data = null;
  try {
    data = JSON.parse(fs.readFileSync(treePath, "utf8"));
  } catch (err) {
    console.error(`[FAIL] context-tree.json JSON parse error: ${err.message}`);
    process.exit(1);
  }

  if (data.schema !== "dizzy.context_tree.v0") {
    console.error(`[FAIL] invalid context-tree schema: ${data.schema}`);
    process.exit(1);
  }

  const indexedCommit = String(data.indexed_commit || "").trim();
  if (!indexedCommit) {
    console.error("[FAIL] context-tree.json missing indexed_commit");
    process.exit(1);
  }
  if (!/^[0-9a-f]{7,40}$/i.test(indexedCommit)) {
    console.error(`[FAIL] context-tree.json indexed_commit is not a git-like SHA: ${indexedCommit}`);
    process.exit(1);
  }
  if (!gitCommitExists(indexedCommit)) {
    console.error(`[FAIL] context-tree.json indexed_commit does not resolve as a local commit: ${indexedCommit}`);
    process.exit(1);
  }

  const liveSha = getLiveHeadSha();
  const sync = process.argv.includes("--sync");

  if (sync && liveSha && indexedCommit !== liveSha) {
    data.indexed_commit = liveSha;
    fs.writeFileSync(treePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    console.log(`[OK] Synced context-tree.json indexed_commit to ${liveSha}`);
  } else if (liveSha && indexedCommit !== liveSha) {
    if (!gitCommitIsAncestor(indexedCommit, liveSha)) {
      console.error(`[FAIL] context-tree.json indexed_commit is not reachable from HEAD: ${indexedCommit}`);
      process.exit(1);
    }
    console.warn(`[WARN] context-tree.json indexed_commit is a reachable snapshot, not current HEAD: ${indexedCommit}`);
  }

  let missingFiles = 0;
  let invalidRanges = 0;

  if (Array.isArray(data.nodes)) {
    for (const node of data.nodes) {
      let targetLineCount = 0;
      if (node.path && node.path !== "reviews/oss_model_synthesis_ledger.md") {
        const abs = path.resolve(process.cwd(), node.path);
        if (!fs.existsSync(abs)) {
          console.warn(`[WARN] Node ${node.id} references missing path: ${node.path}`);
          missingFiles++;
        } else {
          targetLineCount = lineCount(abs);
        }
      }

      if (Array.isArray(node.sections)) {
        for (const s of node.sections) {
          if (typeof s.line_start === "number" && typeof s.line_end === "number") {
            if (s.line_start < 1 || s.line_start > s.line_end) {
              console.error(`[FAIL] Node ${node.id} section "${s.title}" has invalid line range ${s.line_start}-${s.line_end}`);
              invalidRanges++;
            } else if (targetLineCount && s.line_end > targetLineCount) {
              console.error(`[FAIL] Node ${node.id} section "${s.title}" ends past ${node.path} line count ${targetLineCount}: ${s.line_start}-${s.line_end}`);
              invalidRanges++;
            }
          }
        }
      }
    }
  }

  if (invalidRanges > 0) {
    console.error("[FAIL] context-tree.json contains invalid line ranges");
    process.exit(1);
  }
  if (missingFiles > 0) {
    console.error("[FAIL] context-tree.json references missing files");
    process.exit(1);
  }

  console.log("CONTEXT_TREE_CHECK_OK");
}

runCheck();
