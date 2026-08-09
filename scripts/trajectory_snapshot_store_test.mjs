import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  appendTrajectorySnapshot,
  buildTrajectorySnapshot,
  readTrajectorySnapshots,
  verifyTrajectorySnapshot,
} from "../lib/trajectory_snapshot_store.mjs";

console.log("=== W-0067 Trajectory Snapshot Store Test Suite ===");

const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "dizzy_trajectory_snapshot_"));
const trajectoryPath = path.join(fixtureDir, "known_good.jsonl");
const snapshotPath = path.join(fixtureDir, "snapshots.jsonl");

function writeRow(row) {
  fs.appendFileSync(trajectoryPath, `${JSON.stringify(row)}\n`, "utf8");
}

try {
  writeRow({
    id: "traj-before",
    timestamp: "2026-08-08T10:00:00.000Z",
    goal: "Build replay-safe router infrastructure",
    reusable_pattern: "Keep executable claims narrower than review claims.",
    reuse_tags: ["router", "governance"],
    memory_class: "reusable_pattern",
    outcome: "success",
    strength: 8,
  });
  writeRow({
    id: "traj-at-cutoff",
    timestamp: "2026-08-08T12:00:00.000Z",
    goal: "Freeze point in time state",
    reusable_pattern: "Snapshot rows by timestamp cutoff, not by latest file tail.",
    reuse_tags: ["snapshot"],
    memory_class: "reusable_pattern",
    outcome: "partial",
    strength: 7,
  });
  fs.appendFileSync(trajectoryPath, "{malformed-json\n", "utf8");
  writeRow({
    id: "traj-future",
    timestamp: "2026-08-08T12:00:01.000Z",
    goal: "This future row must not leak into the snapshot",
    reusable_pattern: "Future rows are excluded from point in time state.",
    reuse_tags: ["future"],
    memory_class: "reusable_pattern",
    outcome: "success",
    strength: 9,
  });

  const snapshot = buildTrajectorySnapshot({
    filePath: trajectoryPath,
    asOf: "2026-08-08T12:00:00.000Z",
    label: "slice-b-fixture",
  });

  assert.equal(snapshot.schema_version, "dizzy.trajectory_snapshot.v1");
  assert.equal(snapshot.point_in_time.as_of, "2026-08-08T12:00:00.000Z");
  assert.equal(snapshot.source.included_rows, 2);
  assert.equal(snapshot.source.malformed_rows, 1);
  assert.deepEqual(snapshot.items.map((item) => item.id), ["traj-before", "traj-at-cutoff"]);
  assert.equal(snapshot.items.some((item) => item.id === "traj-future"), false);
  assert.equal(snapshot.authority, "evidence_not_authority");
  assert.equal(snapshot.operator_approval_required, true);
  assert.equal(verifyTrajectorySnapshot(snapshot), true);

  const sameSnapshot = buildTrajectorySnapshot({
    filePath: trajectoryPath,
    asOf: "2026-08-08T12:00:00.000Z",
    label: "different-label-does-not-change-content",
  });
  assert.equal(sameSnapshot.snapshot_id, snapshot.snapshot_id);
  assert.equal(sameSnapshot.content_sha256, snapshot.content_sha256);

  const tampered = {
    ...snapshot,
    items: snapshot.items.map((item) => item.id === "traj-before" ? { ...item, outcome: "failure" } : item),
  };
  assert.throws(() => verifyTrajectorySnapshot(tampered), /hash mismatch/i);

  appendTrajectorySnapshot({ snapshot, filePath: snapshotPath });
  const snapshots = readTrajectorySnapshots({ filePath: snapshotPath });
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].snapshot_id, snapshot.snapshot_id);
} finally {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}

console.log("TRAJECTORY_SNAPSHOT_STORE_TESTS_OK");
