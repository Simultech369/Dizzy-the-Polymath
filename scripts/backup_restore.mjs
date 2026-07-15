import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import crypto from "crypto";

const MANIFEST_FILE = "manifest.json";

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function isWithin(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function realPathForContainment(candidate) {
  let current = path.resolve(candidate);
  const missing = [];
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    missing.unshift(path.basename(current));
    current = parent;
  }
  const realCurrent = fs.existsSync(current) ? fs.realpathSync.native(current) : path.resolve(current);
  return missing.length ? path.join(realCurrent, ...missing) : realCurrent;
}

function isWithinRealPath(candidate, parent) {
  return isWithin(realPathForContainment(candidate), realPathForContainment(parent));
}

function printUsage() {
  console.log(`
Dizzy Runtime Snapshot and JSONL Repair Utility

Stop runtime writers before backup or restore.

Usage:
  node scripts/backup_restore.mjs backup [destination-directory]
  node scripts/backup_restore.mjs restore <snapshot-directory>
  node scripts/backup_restore.mjs repair [jsonl-file-or-directory]
`);
}

function walkFiles(rootDir) {
  const root = path.resolve(rootDir);
  const files = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current)) {
      const fullPath = path.join(current, entry);
      const stat = fs.lstatSync(fullPath);

      let isSymOrJunction = stat.isSymbolicLink();
      if (!isSymOrJunction) {
        try {
          fs.readlinkSync(fullPath);
          isSymOrJunction = true;
        } catch {
          // not a link
        }
      }

      if (isSymOrJunction) {
        throw new Error(`Unsupported file type (symlink/junction detected): ${fullPath}`);
      }

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile()) {
        const relPath = path.relative(root, fullPath).replace(/\\/g, "/");
        if (relPath !== MANIFEST_FILE) files.push(relPath);
      } else {
        throw new Error(`Unsupported file type (not a file or directory): ${fullPath}`);
      }
    }
  }
  walk(root);
  return files.sort();
}

function fileSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function buildSnapshotManifest(snapshotDir) {
  const root = path.resolve(snapshotDir);
  const files = {};
  for (const relPath of walkFiles(root)) {
    files[relPath] = fileSha256(path.join(root, relPath));
  }
  return {
    version: 1,
    created_at: new Date().toISOString(),
    files,
  };
}

export function writeSnapshotManifest(snapshotDir) {
  const root = path.resolve(snapshotDir);
  const manifest = buildSnapshotManifest(root);
  fs.writeFileSync(path.join(root, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

export function verifySnapshotManifest(snapshotDir) {
  const root = path.resolve(snapshotDir);
  const manifestPath = path.join(root, MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) throw new Error(`Snapshot missing ${MANIFEST_FILE}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest?.version !== 1 || !manifest.files || typeof manifest.files !== "object") {
    throw new Error("Snapshot manifest is invalid");
  }
  const expected = Object.keys(manifest.files).sort();
  const actual = walkFiles(root);
  if (actual.length !== expected.length || actual.some((relPath, index) => relPath !== expected[index])) {
    throw new Error("Snapshot manifest file list mismatch");
  }
  for (const relPath of expected) {
    const actualHash = fileSha256(path.join(root, relPath));
    if (actualHash !== manifest.files[relPath]) {
      throw new Error(`Snapshot manifest hash mismatch: ${relPath}`);
    }
  }
  return manifest;
}

export function repairJsonlFile(filePath) {
  const resolved = path.resolve(filePath);
  const raw = fs.readFileSync(resolved, "utf8");
  const lines = raw.split(/\r?\n/);
  let lastContentIndex = lines.length - 1;
  while (lastContentIndex >= 0 && lines[lastContentIndex].trim() === "") lastContentIndex -= 1;

  const invalid = [];
  for (let index = 0; index <= lastContentIndex; index += 1) {
    if (!lines[index].trim()) continue;
    try {
      JSON.parse(lines[index]);
    } catch {
      invalid.push(index);
    }
  }

  if (!invalid.length) return { repaired: false, backupPath: "" };
  if (invalid.length !== 1 || invalid[0] !== lastContentIndex) {
    throw new Error(`Refusing repair: corruption is not limited to the final JSONL record in ${resolved}`);
  }

  const backupPath = `${resolved}.bak-${timestamp()}`;
  fs.copyFileSync(resolved, backupPath, fs.constants.COPYFILE_EXCL);
  const repaired = lines.slice(0, lastContentIndex).join("\n");
  const tempPath = `${resolved}.repair-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, repaired ? `${repaired}\n` : "", "utf8");
  fs.renameSync(tempPath, resolved);
  return { repaired: true, backupPath };
}

function jsonlFiles(targetPath) {
  const resolved = path.resolve(targetPath);
  if (fs.statSync(resolved).isFile()) return [resolved];
  const files = [];
  for (const entry of fs.readdirSync(resolved, { withFileTypes: true })) {
    const child = path.join(resolved, entry.name);
    if (entry.isDirectory()) files.push(...jsonlFiles(child));
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(child);
  }
  return files;
}

export function repairJsonlTarget(targetPath) {
  return jsonlFiles(targetPath).map((filePath) => ({ filePath, ...repairJsonlFile(filePath) }));
}

export async function backupRuntime({
  runtimeDir = path.resolve(process.cwd(), "runtime"),
  destination = path.resolve(process.cwd(), "backups", `dizzy-runtime-${timestamp()}`),
} = {}) {
  const source = path.resolve(runtimeDir);
  const target = path.resolve(destination);
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    throw new Error(`Runtime directory not found: ${source}`);
  }
  if (isWithinRealPath(target, source)) throw new Error("Backup destination cannot be inside the runtime directory.");
  if (fs.existsSync(target)) throw new Error(`Backup destination already exists: ${target}`);

  // Pre-flight check: walk and validate source for symlinks/unsupported files
  walkFiles(source);

  const sqlitePath = path.join(source, "operational.sqlite");
  if (fs.existsSync(sqlitePath)) {
    const { openOperationalStore } = await import("../lib/sqlite_operational_store.mjs");
    const store = openOperationalStore(sqlitePath);
    try {
      store.checkpoint("FULL");
    } finally {
      store.close();
    }
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true, errorOnExist: true, force: false });
  writeSnapshotManifest(target);
  return target;
}

export function restoreRuntime({
  sourceDir,
  runtimeDir = path.resolve(process.cwd(), "runtime"),
  recoveryRoot = path.resolve(process.cwd(), "backups"),
  copyRuntime = fs.cpSync,
} = {}) {
  if (!sourceDir) throw new Error("Restore requires a snapshot directory.");
  const source = path.resolve(sourceDir);
  const target = path.resolve(runtimeDir);
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    throw new Error(`Snapshot directory not found: ${source}`);
  }
  if (isWithinRealPath(source, target)) throw new Error("Restore source cannot be inside the runtime directory.");
  verifySnapshotManifest(source);

  const recoveryPath = path.resolve(recoveryRoot, `pre-restore-${timestamp()}`);
  if (fs.existsSync(recoveryPath)) throw new Error(`Recovery path already exists: ${recoveryPath}`);
  fs.mkdirSync(path.dirname(recoveryPath), { recursive: true });

  const hadRuntime = fs.existsSync(target);
  if (hadRuntime) fs.renameSync(target, recoveryPath);
  try {
    copyRuntime(source, target, { recursive: true, errorOnExist: true, force: false });
    verifySnapshotManifest(target);
  } catch (error) {
    fs.rmSync(target, { recursive: true, force: true });
    if (hadRuntime) fs.renameSync(recoveryPath, target);
    throw error;
  }
  return { runtimeDir: target, recoveryPath: hadRuntime ? recoveryPath : "" };
}

async function main() {
  const [command, argument] = process.argv.slice(2);
  if (command === "backup") {
    console.log(await backupRuntime({ destination: argument ? path.resolve(argument) : undefined }));
    return;
  }
  if (command === "restore") {
    console.log(JSON.stringify(restoreRuntime({ sourceDir: argument }), null, 2));
    return;
  }
  if (command === "repair") {
    const target = path.resolve(argument || path.join(process.cwd(), "runtime"));
    console.log(JSON.stringify(repairJsonlTarget(target), null, 2));
    return;
  }
  printUsage();
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(String(error?.message || error));
    process.exitCode = 1;
  });
}
