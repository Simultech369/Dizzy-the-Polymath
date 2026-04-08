import http from "http";
import https from "https";
import dns from "dns/promises";
import net from "net";
import { load } from "cheerio";

function env(name, fallback = "") {
  const v = process.env[name];
  return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
}

function parseIpv4(hostname) {
  const parts = String(hostname || "").trim().split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}

function isPrivateIpv4(nums) {
  const [a, b] = nums;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function parseMappedIpv4FromIpv6(host) {
  const lower = String(host || "").toLowerCase();
  const idx = lower.lastIndexOf("::ffff:");
  if (idx === -1) return null;
  return parseIpv4(lower.slice(idx + "::ffff:".length));
}

function isLocalIpv6(host) {
  const lower = String(host || "").toLowerCase();
  if (!lower) return false;
  if (lower === "::1" || lower === "::") return true;
  const mapped = parseMappedIpv4FromIpv6(lower);
  return Boolean(mapped && mapped[0] === 127);
}

function isPrivateIpv6(host) {
  const lower = String(host || "").toLowerCase();
  if (!lower) return false;

  const mapped = parseMappedIpv4FromIpv6(lower);
  if (mapped) return isPrivateIpv4(mapped);

  const first = lower.split(":")[0];
  const firstNum = Number.parseInt(first || "0", 16);
  if (Number.isNaN(firstNum)) return false;

  if ((firstNum & 0xfe00) === 0xfc00) return true;
  if ((firstNum & 0xffc0) === 0xfe80) return true;
  return false;
}

function classifyAddress(host) {
  const ipVersion = net.isIP(String(host || ""));
  if (ipVersion === 4) {
    const nums = parseIpv4(host);
    if (!nums) return "invalid";
    if (nums[0] === 127) return "localhost";
    return isPrivateIpv4(nums) ? "private" : "public";
  }

  if (ipVersion === 6) {
    if (isLocalIpv6(host)) return "localhost";
    return isPrivateIpv6(host) ? "private" : "public";
  }

  return "hostname";
}

async function resolveHostAddresses(host, timeoutMs) {
  if (classifyAddress(host) !== "hostname") return [host];

  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("DNS lookup timeout")), timeoutMs);
  });

  try {
    const addresses = await Promise.race([
      dns.lookup(host, { all: true, verbatim: true }).then((entries) =>
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

  const host = String(u.hostname || "").toLowerCase();
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

  const transport = targetUrl.protocol === "https:" ? https : http;
  const pathWithQuery = `${targetUrl.pathname || "/"}${targetUrl.search || ""}`;
  const headers = {
    host: hostHeaderForUrl(targetUrl),
  };

  return new Promise((resolve, reject) => {
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
      const chunks = [];
      res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.on("end", () => {
        resolve({
          status: Number(res.statusCode || 0),
          headers: res.headers,
          text: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("Request timeout"));
    });
    req.on("error", reject);
    req.end();
  });
}

async function httpGet(url, timeoutMs = 15000) {
  const maxRedirects = Math.max(0, Number(env("DIZZY_TOOL_MAX_REDIRECTS", "3")) || 3);
  let currentTarget = await validateExternalUrl(url);

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const res = await requestPinnedUrl(currentTarget, timeoutMs);
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
    const extracted = $(selector).text().replace(/\s+/g, " ").trim();

    return {
      url,
      selector,
      status: out.status,
      final_url: out.url,
      extracted: extracted.slice(0, Number(p.maxChars || 2000)),
    };
  }

  throw new Error(`Unknown tool: ${tool}`);
}
