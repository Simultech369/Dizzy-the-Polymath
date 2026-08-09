import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  appendLineageManifest,
  buildDataLineageManifest,
  buildModelLineageManifest,
  readLineageManifests,
  sha256File,
  verifyLineageManifest,
} from "../lib/model_registry.mjs";

console.log("=== W-0067 Model/Data Lineage Manifest Test Suite ===");

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy_model_registry_"));
const modelArtifactPath = path.join(fixtureDir, "Modelfile.dizzy");
const dataArtifactPath = path.join(fixtureDir, "train.jsonl");
const manifestLedgerPath = path.join(fixtureDir, "manifests.jsonl");

try {
  fs.writeFileSync(modelArtifactPath, "FROM gemma3:4b\nPARAMETER temperature 0.2\n", "utf8");
  fs.writeFileSync(dataArtifactPath, "{\"prompt\":\"bounded collaborator\",\"completion\":\"operator approval required\"}\n", "utf8");

  const modelManifest = buildModelLineageManifest({
    subject_id: "gemma3-local-router",
    version: "w0067-slice-b",
    status: "candidate",
    owner: "operator",
    artifacts: [
      { kind: "modelfile", path: modelArtifactPath, media_type: "text/plain" },
    ],
    data_refs: ["dataset:bounded-collaborator-fixture"],
    metrics: [
      { name: "router_fixture_pass", value: true, split: "local", source: "scripts/model_router_test.mjs" },
    ],
    router_receipts: [
      {
        schema_version: "dizzy.router_receipt.v1",
        id: "receipt-fixture-1",
        sha256: "a".repeat(64),
      },
    ],
    created_at: "2026-08-08T12:00:00.000Z",
    notes: "Candidate manifest records local artifact lineage only.",
  });

  assert.equal(modelManifest.schema_version, "dizzy.lineage_manifest.v1");
  assert.equal(modelManifest.subject_type, "model");
  assert.equal(modelManifest.artifacts[0].sha256, sha256File(modelArtifactPath));
  assert.equal(modelManifest.artifacts[0].uri, "external:Modelfile.dizzy");
  assert.equal(modelManifest.authority, "evidence_not_authority");
  assert.equal(modelManifest.operator_approval_required, true);
  assert.equal(verifyLineageManifest(modelManifest), true);

  const sameModelManifest = buildModelLineageManifest({
    subject_id: "gemma3-local-router",
    version: "w0067-slice-b",
    status: "candidate",
    owner: "operator",
    artifacts: [
      { kind: "modelfile", path: modelArtifactPath, media_type: "text/plain" },
    ],
    data_refs: ["dataset:bounded-collaborator-fixture"],
    metrics: [
      { name: "router_fixture_pass", value: true, split: "local", source: "scripts/model_router_test.mjs" },
    ],
    router_receipts: [
      {
        schema_version: "dizzy.router_receipt.v1",
        id: "receipt-fixture-1",
        sha256: "a".repeat(64),
      },
    ],
    created_at: "2026-08-08T12:00:00.000Z",
    notes: "Candidate manifest records local artifact lineage only.",
  });
  assert.equal(sameModelManifest.manifest_sha256, modelManifest.manifest_sha256);

  const dataManifest = buildDataLineageManifest({
    subject_id: "bounded-collaborator-fixture",
    version: "2026-08-08",
    status: "candidate",
    artifacts: [
      { kind: "training_jsonl", path: dataArtifactPath, media_type: "application/jsonl" },
    ],
    parents: ["trajectory_snapshot:traj_snap_fixture"],
    created_at: "2026-08-08T12:05:00.000Z",
  });
  assert.equal(dataManifest.subject_type, "data");
  assert.equal(dataManifest.artifacts[0].sha256, sha256File(dataArtifactPath));
  assert.equal(verifyLineageManifest(dataManifest), true);

  const tampered = { ...modelManifest, status: "active" };
  assert.throws(() => verifyLineageManifest(tampered), /hash mismatch/i);
  assert.throws(() => buildModelLineageManifest({ subject_id: "missing-artifact", artifacts: [] }), /at least one artifact/i);
  assert.throws(
    () => buildDataLineageManifest({
      subject_id: "bad-hash",
      artifacts: [{ kind: "dataset", uri: "memory://dataset", sha256: "not-a-hash" }],
    }),
    /invalid artifact sha256/i,
  );
  assert.throws(
    () => buildModelLineageManifest({
      subject_id: "bad-receipt",
      artifacts: [{ kind: "weights", uri: "memory://model", sha256: "b".repeat(64) }],
      router_receipts: [{ id: "bad-receipt-ref", sha256: "not-a-hash" }],
    }),
    /invalid receipt sha256/i,
  );

  appendLineageManifest({ manifest: modelManifest, filePath: manifestLedgerPath });
  appendLineageManifest({ manifest: dataManifest, filePath: manifestLedgerPath });
  const manifests = readLineageManifests({ filePath: manifestLedgerPath });
  assert.equal(manifests.length, 2);
  assert.deepEqual(manifests.map((manifest) => manifest.subject_type), ["model", "data"]);
} finally {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}

console.log("MODEL_REGISTRY_TESTS_OK");
