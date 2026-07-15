import http from "http";
import https from "https";
import dns from "dns/promises";
import net from "net";
import { load } from "cheerio";
import { ethers } from "ethers";
import { sanitizeUntrustedInput } from "./janitor.mjs";

function env(name, fallback = "") {
  const v = process.env[name];
  return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
}

function parsePositiveInteger(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function parseContentLength(headers = {}) {
  const raw = headers["content-length"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const text = String(value || "").trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) ? n : null;
}

function parseIpv4(hostname) {
  const parts = String(hostname || "").trim().split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}

function normalizeHostname(hostname) {
  const value = String(hostname || "").trim().toLowerCase();
  return value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
}

function isPrivateIpv4(nums) {
  const [a, b] = nums;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function parseMappedIpv4FromIpv6(host) {
  const lower = String(host || "").toLowerCase();
  const idx = lower.lastIndexOf("::ffff:");
  if (idx === -1) return null;
  return parseIpv4(lower.slice(idx + "::ffff:".length));
}

function expandIpv6(host) {
  const cleanHost = String(host || "").trim().toLowerCase();
  const parts = cleanHost.split(":");
  if (parts.length < 3 || parts.length > 9) return null;

  const doubleColonIdx = cleanHost.indexOf("::");
  if (doubleColonIdx !== -1) {
    const left = cleanHost.slice(0, doubleColonIdx).split(":").filter(Boolean);
    const right = cleanHost.slice(doubleColonIdx + 2).split(":").filter(Boolean);
    const middle = Array(8 - left.length - right.length).fill("0");
    return [...left, ...middle, ...right];
  }
  return parts.length === 8 ? parts : null;
}

function parseMappedIpv4(host) {
  const dotted = parseMappedIpv4FromIpv6(host);
  if (dotted) return dotted;

  const groups = expandIpv6(host);
  if (groups &&
      groups[0] === "0" && groups[1] === "0" && groups[2] === "0" &&
      groups[3] === "0" && groups[4] === "0" && groups[5] === "ffff") {
    const val6 = parseInt(groups[6], 16);
    const val7 = parseInt(groups[7], 16);
    if (!Number.isNaN(val6) && !Number.isNaN(val7)) {
      return [
        (val6 >> 8) & 255,
        val6 & 255,
        (val7 >> 8) & 255,
        val7 & 255
      ];
    }
  }
  return null;
}

function isLocalIpv6(host) {
  const lower = String(host || "").toLowerCase();
  if (!lower) return false;
  if (lower === "::1" || lower === "::") return true;
  const mapped = parseMappedIpv4(lower);
  return Boolean(mapped && (mapped[0] === 127 || mapped[0] === 0));
}

function isPrivateIpv6(host) {
  const lower = String(host || "").toLowerCase();
  if (!lower) return false;

  const mapped = parseMappedIpv4(lower);
  if (mapped) return isPrivateIpv4(mapped);

  const first = lower.split(":")[0];
  const firstNum = Number.parseInt(first || "0", 16);
  if (Number.isNaN(firstNum)) return false;

  if ((firstNum & 0xfe00) === 0xfc00) return true;
  if ((firstNum & 0xffc0) === 0xfe80) return true;
  return false;
}

function classifyAddress(host) {
  const normalizedHost = normalizeHostname(host);
  const ipVersion = net.isIP(normalizedHost);
  if (ipVersion === 4) {
    const nums = parseIpv4(normalizedHost);
    if (!nums) return "invalid";
    if (nums[0] === 127 || nums[0] === 0) return "localhost";
    return isPrivateIpv4(nums) ? "private" : "public";
  }

  if (ipVersion === 6) {
    if (isLocalIpv6(normalizedHost)) return "localhost";
    return isPrivateIpv6(normalizedHost) ? "private" : "public";
  }

  return "hostname";
}

async function resolveHostAddresses(host, timeoutMs) {
  const normalizedHost = normalizeHostname(host);
  if (classifyAddress(normalizedHost) !== "hostname") return [normalizedHost];

  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("DNS lookup timeout")), timeoutMs);
  });

  try {
    const addresses = await Promise.race([
      dns.lookup(normalizedHost, { all: true, verbatim: true }).then((entries) =>
        entries.map((entry) => String(entry?.address || "")).filter(Boolean),
      ),
      timeoutPromise,
    ]);
    if (!Array.isArray(addresses) || addresses.length === 0) throw new Error("DNS lookup returned no addresses");
    return addresses;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function pickPinnedAddress(addresses) {
  const list = Array.isArray(addresses) ? addresses.map((x) => String(x || "").trim()).filter(Boolean) : [];
  const publicAddress = list.find((address) => classifyAddress(address) === "public");
  return publicAddress || list[0] || "";
}

function hostHeaderForUrl(u) {
  const isDefaultPort = (u.protocol === "http:" && (!u.port || u.port === "80"))
    || (u.protocol === "https:" && (!u.port || u.port === "443"));
  return isDefaultPort ? u.host.replace(/:\d+$/, "") : u.host;
}

export async function validateExternalUrl(url) {
  const allowLocalhost = String(env("DIZZY_TOOL_ALLOW_LOCALHOST", "0")).trim() === "1";
  const allowPrivateNet = String(env("DIZZY_TOOL_ALLOW_PRIVATE_NET", "0")).trim() === "1";
  const dnsTimeoutMs = Math.max(250, Number(env("DIZZY_TOOL_DNS_TIMEOUT_MS", "2000")) || 2000);

  let u;
  try {
    u = new URL(String(url || ""));
  } catch {
    throw new Error("Invalid URL");
  }

  const protocol = String(u.protocol || "").toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }

  if (u.username || u.password) {
    throw new Error("Credentials in URLs are not allowed");
  }

  const host = normalizeHostname(u.hostname);
  if (!host) throw new Error("Missing URL host");

  const addresses = await resolveHostAddresses(host, dnsTimeoutMs);
  for (const address of addresses) {
    const kind = classifyAddress(address);
    if (kind === "localhost" && !allowLocalhost) {
      throw new Error("Localhost URLs require DIZZY_TOOL_ALLOW_LOCALHOST=1");
    }
    if (kind === "private" && !allowPrivateNet) {
      throw new Error("Private-network URLs require DIZZY_TOOL_ALLOW_PRIVATE_NET=1");
    }
  }

  return {
    url: u.toString(),
    hostname: host,
    addresses,
    pinnedAddress: pickPinnedAddress(addresses),
  };
}

function resolveRedirectUrl(currentUrl, locationHeader) {
  try {
    return new URL(String(locationHeader || ""), currentUrl).toString();
  } catch {
    throw new Error("Invalid redirect location");
  }
}

async function requestPinnedUrl(validatedTarget, timeoutMs) {
  const targetUrl = new URL(validatedTarget.url);
  const connectAddress = String(validatedTarget.pinnedAddress || "").trim();
  if (!connectAddress) throw new Error("DNS lookup returned no connectable addresses");

  const maxBytes = parsePositiveInteger(env("DIZZY_TOOL_MAX_RESPONSE_BYTES", "5242880"), 5242880);
  const absoluteTimeoutMs = parsePositiveInteger(timeoutMs, 15000);
  const transport = targetUrl.protocol === "https:" ? https : http;
  const pathWithQuery = `${targetUrl.pathname || "/"}${targetUrl.search || ""}`;
  const headers = {
    host: hostHeaderForUrl(targetUrl),
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    let absoluteTimer = null;
    function finish(value) {
      if (settled) return;
      settled = true;
      if (absoluteTimer) clearTimeout(absoluteTimer);
      resolve(value);
    }
    function fail(err) {
      if (settled) return;
      settled = true;
      if (absoluteTimer) clearTimeout(absoluteTimer);
      reject(err);
    }

    const req = transport.request({
      protocol: targetUrl.protocol,
      hostname: connectAddress,
      port: targetUrl.port || undefined,
      method: "GET",
      path: pathWithQuery,
      headers,
      servername: targetUrl.hostname,
      family: net.isIP(connectAddress) || undefined,
      lookup: (_hostname, _opts, cb) => cb(null, connectAddress, net.isIP(connectAddress) || 4),
    }, (res) => {
      const declaredLength = parseContentLength(res.headers);
      if (declaredLength !== null && declaredLength > maxBytes) {
        const err = new Error(`HTTP response exceeds DIZZY_TOOL_MAX_RESPONSE_BYTES (${maxBytes} bytes)`);
        res.destroy(err);
        req.destroy(err);
        fail(err);
        return;
      }

      const chunks = [];
      let totalBytes = 0;
      res.on("data", (chunk) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buf.length;
        if (totalBytes > maxBytes) {
          const err = new Error(`HTTP response exceeds DIZZY_TOOL_MAX_RESPONSE_BYTES (${maxBytes} bytes)`);
          res.destroy(err);
          req.destroy(err);
          fail(err);
          return;
        }
        chunks.push(buf);
      });
      res.on("end", () => {
        finish({
          status: Number(res.statusCode || 0),
          headers: res.headers,
          text: Buffer.concat(chunks, totalBytes).toString("utf8"),
        });
      });
      res.on("error", fail);
    });

    absoluteTimer = setTimeout(() => {
      const err = new Error(`Request absolute timeout after ${absoluteTimeoutMs}ms`);
      req.destroy(err);
      fail(err);
    }, absoluteTimeoutMs);
    req.setTimeout(absoluteTimeoutMs, () => {
      const err = new Error("Request inactivity timeout");
      req.destroy(err);
      fail(err);
    });
    req.on("error", fail);
    req.end();
  });
}

async function httpGet(url, timeoutMs = 15000) {
  const rawRedirects = env("DIZZY_TOOL_MAX_REDIRECTS", "3");
  const parsedRedirects = parseInt(rawRedirects, 10);
  const maxRedirects = Number.isInteger(parsedRedirects) && parsedRedirects >= 0 ? parsedRedirects : 3;

  const deadline = Date.now() + Math.max(50, timeoutMs);
  let currentTarget = await validateExternalUrl(url);

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error(`Request absolute timeout after ${timeoutMs}ms`);
    }

    const res = await requestPinnedUrl(currentTarget, remaining);
    if (res.status >= 300 && res.status < 400) {
      if (hop === maxRedirects) {
        const err = new Error("Too many redirects");
        err.status = res.status;
        throw err;
      }
      const location = res.headers.location;
      if (!location) {
        const err = new Error(`Redirect ${res.status} missing location`);
        err.status = res.status;
        throw err;
      }
      currentTarget = await validateExternalUrl(resolveRedirectUrl(currentTarget.url, Array.isArray(location) ? location[0] : location));
      continue;
    }

    if (res.status < 200 || res.status >= 300) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.body = res.text.slice(0, 2000);
      throw err;
    }
    return { url: currentTarget.url, status: res.status, text: res.text };
  }

  throw new Error("Redirect handling failed");
}

export async function runToolJob(job) {
  const tool = job.tool;
  const p = job.payload ?? {};

  if (tool === "http_get") {
    const url = String(p.url || "");
    if (!url) throw new Error("Missing payload.url");
    const out = await httpGet(url, Number(p.timeoutMs || 15000));
    return { url: out.url, status: out.status, bytes: out.text.length };
  }

  if (tool === "cheerio_extract") {
    const url = String(p.url || "");
    const selector = String(p.selector || "body");
    if (!url) throw new Error("Missing payload.url");

    const out = await httpGet(url, Number(p.timeoutMs || 15000));
    const $ = load(out.text);
    const selected = $(selector);
    const extractedRaw = selected.text().replace(/\s+/g, " ").trim();
    const selectedHtml = selected.toArray().map((el) => $.html(el)).join("\n");
    const selectedAttributes = selected.toArray()
      .flatMap((el) => Object.values(el.attribs || {}))
      .map((value) => String(value || ""))
      .join("\n");
    if (sanitizeUntrustedInput(`${selectedHtml}\n${selectedAttributes}`).flagged) {
      const err = new Error("cheerio_extract blocked: flagged untrusted content");
      err.status = 400;
      throw err;
    }
    const sliced = extractedRaw.slice(0, Number(p.maxChars || 2000));
    const { sanitized, flagged } = sanitizeUntrustedInput(sliced);
    if (flagged) {
      const err = new Error("cheerio_extract blocked: flagged untrusted content");
      err.status = 400;
      throw err;
    }

    return {
      url,
      selector,
      status: out.status,
      final_url: out.url,
      extracted: sanitized,
      flagged,
    };
  }

  if (tool === "read_contract") {
    const rpcUrl = String(p.rpcUrl || "http://127.0.0.1:8545");
    const contractAddress = String(p.contractAddress || "");
    const abi = p.abi;
    const functionName = String(p.functionName || "");
    const args = p.args || [];

    if (!contractAddress) throw new Error("Missing payload.contractAddress");
    if (!abi) throw new Error("Missing payload.abi");
    if (!functionName) throw new Error("Missing payload.functionName");

    // Validate connection URL for safety/boundaries
    const validated = await validateExternalUrl(rpcUrl);

    // HTTPS RPC is preflight-classified only; not end-to-end pinned.
    let connection = validated.url;
    if (rpcUrl.startsWith("http://") && validated.pinnedAddress) {
      const u = new URL(validated.url);
      u.hostname = validated.pinnedAddress;
      const req = new ethers.FetchRequest(u.toString());
      req.setHeader("host", validated.hostname);
      connection = req;
    }

    // Initialize provider and contract
    const provider = new ethers.JsonRpcProvider(connection);
    const contract = new ethers.Contract(contractAddress, abi, provider);

    // Call function
    const result = await contract[functionName](...args);

    // Serialize result to handle BigInts and complex types
    const serialize = (val) => {
      if (val === null || val === undefined) return val;
      if (typeof val === "bigint") return val.toString();
      if (Array.isArray(val)) return val.map(serialize);
      if (typeof val === "object") {
        const out = {};
        for (const k of Object.keys(val)) {
          out[k] = serialize(val[k]);
        }
        return out;
      }
      return val;
    };

    return {
      success: true,
      result: serialize(result),
    };
  }

  throw new Error(`Unknown tool: ${tool}`);
}
