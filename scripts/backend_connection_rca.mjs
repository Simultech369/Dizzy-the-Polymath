import fs from "fs";
import net from "net";
import path from "path";
import {
  classifyConnectionFailure,
} from "../lib/backend_connection_rca.mjs";
import {
  isLoopbackHost,
  isPrivateLanHost,
} from "../lib/model_router.mjs";
import {
  summarizeHarnessOutput,
} from "../lib/review_cycle_runner.mjs";

function argValue(args, name, fallback = "") {
  const idx = args.indexOf(name);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return fallback;
}

function boolArg(args, name) {
  return args.includes(name);
}

function parseBaseUrl(baseUrl = "") {
  try {
    const url = new URL(String(baseUrl || "").trim());
    return {
      ok: true,
      url,
      host: url.hostname,
      port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
      isLocal: isLoopbackHost(url.hostname) || isPrivateLanHost(url.hostname),
    };
  } catch {
    return {
      ok: false,
      url: null,
      host: "",
      port: 0,
      isLocal: false,
    };
  }
}

function readLogTail(logPath = "", maxChars = 6000) {
  if (!logPath) return "";
  try {
    const absPath = path.resolve(process.cwd(), logPath);
    const stat = fs.statSync(absPath);
    if (!stat.isFile()) return "";
    const fd = fs.openSync(absPath, "r");
    try {
      const size = Math.min(stat.size, maxChars);
      const buffer = Buffer.alloc(size);
      fs.readSync(fd, buffer, 0, size, Math.max(0, stat.size - size));
      return summarizeHarnessOutput(buffer.toString("utf8"), maxChars);
    } finally {
      fs.closeSync(fd);
    }
  } catch (err) {
    return `log_read_failed=${summarizeHarnessOutput(err?.message || err, 700)}`;
  }
}

function probeTcp(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    if (!host || !port) {
      resolve({ reachable: false, error: "missing host or port" });
      return;
    }
    const socket = net.createConnection({ host, port });
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done({ reachable: true, error: "" }));
    socket.once("timeout", () => done({ reachable: false, error: "tcp probe timed out" }));
    socket.once("error", (err) => done({ reachable: false, error: err?.message || String(err) }));
  });
}

async function probeHttp(baseUrl, timeoutMs = 1500) {
  const parsed = parseBaseUrl(baseUrl);
  if (!parsed.ok || !parsed.isLocal) {
    return { reachable: false, status: "", error: parsed.ok ? "remote http probe skipped" : "invalid base url" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const probeUrl = `${parsed.url.origin}/api/tags`;
    const response = await fetch(probeUrl, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });
    return { reachable: true, status: String(response.status), error: "" };
  } catch (err) {
    return { reachable: false, status: "", error: err?.message || String(err) };
  } finally {
    clearTimeout(timer);
  }
}

const args = process.argv.slice(2);
const baseUrl = argValue(args, "--base-url", "http://127.0.0.1:11434/v1");
const backend = argValue(args, "--backend", "ollama");
const model = argValue(args, "--model", "gemma3:4b");
const trustZone = argValue(args, "--trust-zone", "private_self");
const error = argValue(args, "--error", "");
const logPath = argValue(args, "--log", "");
const allowCloud = boolArg(args, "--allow-cloud");
const noProbe = boolArg(args, "--no-probe");

const parsed = parseBaseUrl(baseUrl);
const probes = {};
if (!noProbe) {
  const tcp = await probeTcp(parsed.host, parsed.port);
  probes.tcpReachable = tcp.reachable;
  if (tcp.error) probes.tcpError = tcp.error;

  const http = await probeHttp(baseUrl);
  probes.httpReachable = http.reachable;
  if (http.status) probes.httpStatus = http.status;
  if (http.error) probes.httpError = http.error;
}
const logEvidence = readLogTail(logPath);
if (logEvidence) probes.logEvidence = logEvidence;

const diagnosis = classifyConnectionFailure({
  error,
  baseUrl,
  backend,
  model,
  trustZone,
  allowCloud,
  isLocalIsolationRequired: trustZone === "private_self" || parsed.isLocal || backend === "ollama",
  probes,
});

console.log(JSON.stringify(diagnosis, null, 2));
