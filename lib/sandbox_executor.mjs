import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const REPORT_MARKER = "DIZZY_SANDBOX_REPORT:";

const DANGEROUS_PATTERNS = [
  // Module imports
  /require\s*\(\s*['"](fs|os|path|http|https|net|dgram|dns|tls|crypto|child_process)['"]\s*\)/,
  /import\s+.*\s+from\s+['"](fs|os|path|http|https|net|dgram|dns|tls|crypto|child_process)['"]/,
  // Common dangerous properties/methods
  /\b(fs|os|path|http|https|net|dgram|dns|tls|crypto)\./,
  /\b(child_process)\b/,
  /\b(spawn|exec|fork)\s*\(/,
  /\bprocess\.(env|exit|kill|chdir|memoryUsage|uptime|cpuUsage)\b/,
  /\beval\s*\(/,
];

/**
 * Creates a temporary, sandboxed environment to execute a transient
 * test harness script.
 *
 * @param {{
 *   scriptContent: string,
 *   scriptExtension?: "js" | "py" | "sh",
 *   timeout?: number
 * }} options
 * @returns {Promise<{
 *   ok: boolean,
 *   exitCode: number | null,
 *   stdout: string,
 *   stderr: string,
 *   report: any,
 *   error?: string
 * }>}
 */
export function runInSandbox({
  scriptContent,
  scriptExtension = "js",
  timeout = 15000,
  dangerouslyBypassPrefilter = false,
}) {
  if (!dangerouslyBypassPrefilter) {
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(scriptContent)) {
        return Promise.resolve({
          ok: false,
          exitCode: null,
          stdout: "",
          stderr: `Sandbox Pre-filter: Blocked potentially dangerous script content matching ${pattern.toString()}`,
          report: null,
          error: "Sandbox pre-filter check failed",
        });
      }
    }
  }

  return new Promise((resolve) => {
    const scratchDir = path.join(os.tmpdir(), `dizzy-sandbox-${Date.now()}`);
    fs.mkdirSync(scratchDir, { recursive: true });
    const scriptPath = path.join(scratchDir, `harness.${scriptExtension}`);
    const reportPath = path.join(scratchDir, "report.json");

    fs.writeFileSync(scriptPath, scriptContent, "utf8");

    const executor = scriptExtension === "py" ? "python" : "node";
    const child = spawn(executor, [scriptPath, "--report-path", reportPath], {
      timeout,
      windowsHide: true,
      env: { ...process.env, DIZZY_SANDBOX_MODE: "true" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let timer = null;
    if (timeout && timeout > 0) {
      timer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {}
      }, timeout + 200);
    }

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => (stdout += data.toString()));
    child.stderr.on("data", (data) => (stderr += data.toString()));

    child.on("close", (exitCode) => {
      if (timer) clearTimeout(timer);
      let report = null;
      try {
        if (fs.existsSync(reportPath)) {
          report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
        }
      } catch (e) {
        stderr += `\nError reading report.json: ${e.message}`;
      }
      if (!report) {
        const reportLine = stdout.split(/\r?\n/).find((line) => line.startsWith(REPORT_MARKER));
        if (reportLine) {
          try {
            report = JSON.parse(reportLine.slice(REPORT_MARKER.length));
          } catch (e) {
            stderr += `\nError reading stdout sandbox report: ${e.message}`;
          }
        }
      }

      fs.rm(scratchDir, { recursive: true, force: true }, () => {
        resolve({
          ok: exitCode === 0,
          exitCode,
          stdout: stdout.split(/\r?\n/).filter((line) => !line.startsWith(REPORT_MARKER)).join("\n"),
          stderr,
          report,
        });
      });
    });

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      fs.rm(scratchDir, { recursive: true, force: true }, () => {
        resolve({
          ok: false,
          exitCode: null,
          stdout,
          stderr,
          report: null,
          error: `Process spawn error: ${err.message}`,
        });
      });
    });
  });
}
