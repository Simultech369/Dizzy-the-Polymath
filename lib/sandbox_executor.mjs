import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

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
}) {
  return new Promise((resolve) => {
    const scratchDir = path.join(os.tmpdir(), `dizzy-sandbox-${Date.now()}`);
    fs.mkdirSync(scratchDir, { recursive: true });
    const scriptPath = path.join(scratchDir, `harness.${scriptExtension}`);
    const reportPath = path.join(scratchDir, "report.json");

    fs.writeFileSync(scriptPath, scriptContent, "utf8");

    const executor = scriptExtension === "py" ? "python" : "node";
    const child = spawn(executor, [scriptPath, "--report-path", reportPath], {
      timeout,
      env: { ...process.env, DIZZY_SANDBOX_MODE: "true" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => (stdout += data.toString()));
    child.stderr.on("data", (data) => (stderr += data.toString()));

    child.on("close", (exitCode) => {
      let report = null;
      try {
        if (fs.existsSync(reportPath)) {
          report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
        }
      } catch (e) {
        stderr += `\nError reading report.json: ${e.message}`;
      }

      fs.rm(scratchDir, { recursive: true, force: true }, () => {
        resolve({
          ok: exitCode === 0,
          exitCode,
          stdout,
          stderr,
          report,
        });
      });
    });

    child.on("error", (err) => {
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
