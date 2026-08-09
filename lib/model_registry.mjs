import crypto from "crypto";
import fs from "fs";
import path from "path";
import { durableAppendJsonl, redactSecretMaterial } from "./durable_write_policy.mjs";

const SUBJECT_TYPES = new Set(["model", "data"]);
const STATUSES = new Set(["candidate", "active", "deprecated", "quarantined"]);

function env(name, fallback = "") {
  const v = process.env[name];
  return (v === undefined || v === null || String(v).trim() === "") ? fallback : String(v);
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

export function sha256Text(text) {
  return crypto.createHash("sha256").update(String(text ?? ""), "utf8").digest("hex");
}

export function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.resolve(process.cwd(), filePath))).digest("hex");
}

function normalizeString(value, maxChars = 500) {
  return redactSecretMaterial(String(value ?? "").trim()).slice(0, maxChars);
}

function normalizeList(value, maxItems = 20, maxChars = 240) {
  const items = Array.isArray(value) ? value : String(value ?? "").split(/,|\n|;/g);
  return items.map((item) => normalizeString(item, maxChars)).filter(Boolean).slice(0, maxItems);
}

function manifestLedgerPath() {
  return path.resolve(process.cwd(), env("DIZZY_LINEAGE_MANIFEST_PATH", "runtime/lineage/manifests.jsonl"));
}

function normalizeArtifact(artifact = {}) {
  const kind = normalizeString(artifact.kind || "artifact", 80);
  const label = normalizeString(artifact.label || artifact.name || kind, 120);
  let uri = normalizeString(artifact.uri || "", 500);
  if (!uri && artifact.path) {
    const resolvedPath = path.resolve(process.cwd(), artifact.path);
    const relativePath = path.relative(process.cwd(), resolvedPath).replace(/\\/g, "/");
    const insideRepo = relativePath && !relativePath.startsWith("../") && relativePath !== ".." && !path.isAbsolute(relativePath);
    uri = insideRepo ? relativePath : `external:${path.basename(resolvedPath)}`;
  }
  const sha256 = normalizeString(artifact.sha256 || "", 128).toLowerCase();

  if (!uri && !sha256) throw new Error("lineage artifact requires uri/path or sha256");
  let contentSha256 = sha256;
  if (!contentSha256 && artifact.path) {
    contentSha256 = sha256File(artifact.path);
  }
  if (contentSha256 && !/^[a-f0-9]{64}$/.test(contentSha256)) {
    throw new Error(`invalid artifact sha256 for ${label}`);
  }

  return {
    kind,
    label,
    uri,
    sha256: contentSha256 || "",
    media_type: normalizeString(artifact.media_type || artifact.mediaType || "", 120),
  };
}

function normalizeMetric(metric = {}) {
  const name = normalizeString(metric.name, 120);
  if (!name) throw new Error("lineage metric requires name");
  const value = typeof metric.value === "number" || typeof metric.value === "boolean"
    ? metric.value
    : normalizeString(metric.value, 120);
  return {
    name,
    value,
    split: normalizeString(metric.split, 80),
    source: normalizeString(metric.source, 240),
  };
}

function normalizeReceiptRef(ref = {}) {
  const schema = normalizeString(ref.schema_version || ref.schema || "", 120);
  const id = normalizeString(ref.task_id || ref.id || ref.receipt_id || "", 160);
  const sha256 = normalizeString(ref.sha256 || "", 128).toLowerCase();
  if (sha256 && !/^[a-f0-9]{64}$/.test(sha256)) throw new Error(`invalid receipt sha256 for ${id || schema || "receipt"}`);
  return {
    schema_version: schema,
    id,
    sha256,
  };
}

function stripManifestHash(manifest) {
  const { manifest_sha256, ...rest } = manifest;
  return rest;
}

export function buildLineageManifest(input = {}, opts = {}) {
  const subjectType = normalizeString(input.subject_type || input.subjectType || opts.subjectType || "model", 40).toLowerCase();
  if (!SUBJECT_TYPES.has(subjectType)) throw new Error(`invalid lineage subject_type: ${subjectType}`);
  const subjectId = normalizeString(input.subject_id || input.subjectId || input.model_id || input.dataset_id, 160);
  if (!subjectId) throw new Error("lineage manifest requires subject_id");
  const status = normalizeString(input.status || "candidate", 40).toLowerCase();
  if (!STATUSES.has(status)) throw new Error(`invalid lineage status: ${status}`);

  const artifacts = (Array.isArray(input.artifacts) ? input.artifacts : [])
    .map(normalizeArtifact)
    .sort((a, b) => `${a.kind}:${a.label}:${a.uri}`.localeCompare(`${b.kind}:${b.label}:${b.uri}`));
  if (!artifacts.length) throw new Error("lineage manifest requires at least one artifact");

  const manifest = {
    schema_version: "dizzy.lineage_manifest.v1",
    subject_type: subjectType,
    subject_id: subjectId,
    version: normalizeString(input.version || "0.0.0-local", 80),
    status,
    created_at: normalizeString(input.created_at || opts.now?.toISOString?.() || new Date().toISOString(), 80),
    owner: normalizeString(input.owner || "operator", 120),
    artifacts,
    parents: normalizeList(input.parents, 20, 240),
    data_refs: normalizeList(input.data_refs || input.dataRefs, 20, 240),
    model_refs: normalizeList(input.model_refs || input.modelRefs, 20, 240),
    metrics: (Array.isArray(input.metrics) ? input.metrics : []).map(normalizeMetric),
    router_receipts: (Array.isArray(input.router_receipts) ? input.router_receipts : []).map(normalizeReceiptRef),
    notes: normalizeString(input.notes, 1000),
    authority: "evidence_not_authority",
    operator_approval_required: true,
  };
  manifest.manifest_sha256 = sha256Text(stableStringify(stripManifestHash(manifest)));
  return manifest;
}

export function buildModelLineageManifest(input = {}, opts = {}) {
  return buildLineageManifest({ ...input, subject_type: "model" }, opts);
}

export function buildDataLineageManifest(input = {}, opts = {}) {
  return buildLineageManifest({ ...input, subject_type: "data" }, opts);
}

export function verifyLineageManifest(manifest) {
  if (!manifest || typeof manifest !== "object") throw new Error("lineage manifest must be an object");
  if (manifest.schema_version !== "dizzy.lineage_manifest.v1") throw new Error("invalid lineage manifest schema");
  if (!SUBJECT_TYPES.has(manifest.subject_type)) throw new Error("invalid lineage subject_type");
  if (manifest.authority !== "evidence_not_authority") throw new Error("lineage authority must remain evidence_not_authority");
  if (manifest.operator_approval_required !== true) throw new Error("lineage manifest requires operator approval");
  const expected = sha256Text(stableStringify(stripManifestHash(manifest)));
  if (expected !== manifest.manifest_sha256) throw new Error("lineage manifest hash mismatch");
  return true;
}

export function appendLineageManifest({ manifest, filePath = manifestLedgerPath() } = {}) {
  const row = manifest || buildLineageManifest();
  verifyLineageManifest(row);
  durableAppendJsonl(path.resolve(process.cwd(), filePath), row);
  return row;
}

export function readLineageManifests({ filePath = manifestLedgerPath(), maxRows = 500 } = {}) {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) return [];
  const limit = Math.max(1, Number(maxRows) || 500);
  const lines = fs.readFileSync(resolved, "utf8").split(/\r?\n/).filter(Boolean).slice(-limit);
  const out = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      verifyLineageManifest(parsed);
      out.push(parsed);
    } catch {
      // Lineage readers fail soft; verification scripts report malformed evidence.
    }
  }
  return out;
}
