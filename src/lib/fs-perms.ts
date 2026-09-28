import fs from "fs";
import path from "path";

/** Owner-only modes for SQLite + upload artifacts. */
export const MODE_FILE = 0o600;
export const MODE_DIR = 0o700;

export function ensurePrivateDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: MODE_DIR });
  }
  try {
    fs.chmodSync(dir, MODE_DIR);
  } catch {
    /* ignore unsupported FS */
  }
}

export function chmodPrivateFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.chmodSync(filePath, MODE_FILE);
  } catch {
    /* ignore */
  }
}

/** Chmod DB primary + WAL/SHM sidecars if present. */
export function chmodDbArtifacts(dbPath: string): void {
  chmodPrivateFile(dbPath);
  for (const suffix of ["-wal", "-shm"]) {
    chmodPrivateFile(dbPath + suffix);
  }
  ensurePrivateDir(path.dirname(dbPath));
}
