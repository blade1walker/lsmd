import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { backupsDir, databaseFile } from "../paths";
import { log } from "../log";

/**
 * Backups of the SQLite database, taken while the site runs.
 *
 * SQLite's online backup copies the database page by page through its own
 * locking, so the copy is consistent even while the site keeps writing (WAL
 * lets the site carry on reading and writing meanwhile). Every copy is
 * opened and integrity-checked before it counts; one that fails is deleted
 * rather than kept as a false promise.
 *
 * Backups are DATA_DIR/backups/lsmd-<when>-<reason>.db. Restore one with
 * `npm run db:restore -- <file>` (scripts/db-restore.ts).
 */

export interface BackupInfo {
  file: string;
  name: string;
  bytes: number;
  createdAt: Date;
}

/** How many of each kind to keep; older ones are deleted after a new backup. */
const KEEP: Record<string, number> = { daily: 14, deploy: 10, "pre-restore": 5 };

function stamp(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

/** Opens a copy and checks every page. Returns the problem, or null when sound. */
export function checkIntegrity(file: string): string | null {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const result = db.pragma("integrity_check", { simple: true });
    return result === "ok" ? null : String(result);
  } finally {
    db.close();
  }
}

/**
 * Copies `source` (the site's database by default) to `target` and verifies
 * the copy. Written under a temporary name and renamed when sound, so a
 * half-written file never looks like a backup.
 */
export async function copyDatabase(target: string, source = databaseFile()): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
  const partial = `${target}.partial`;
  const removePartial = () => Promise.all([partial, `${partial}-wal`, `${partial}-shm`].map((f) => rm(f, { force: true })));
  await removePartial();
  try {
    const db = new Database(source, { readonly: true, fileMustExist: true });
    try {
      await db.backup(partial);
    } finally {
      db.close();
    }
    // The copy comes out in WAL mode like the original; as a backup it should
    // be one self-contained file. (The site switches it back when it opens it.)
    const copy = new Database(partial);
    try {
      copy.pragma("journal_mode = DELETE");
    } finally {
      copy.close();
    }
    const problem = checkIntegrity(partial);
    if (problem) throw new Error(`The backup copy failed its integrity check: ${problem}`);
    await rename(partial, target);
  } finally {
    await removePartial();
  }
}

/** Takes a verified backup into DATA_DIR/backups and prunes old ones of the same kind. */
export async function backupDatabase(reason: string): Promise<BackupInfo> {
  const name = `lsmd-${stamp()}-${reason}.db`;
  const file = path.join(backupsDir(), name);
  await copyDatabase(file);
  await pruneBackups(reason);
  const { size, mtime } = await stat(file);
  return { file, name, bytes: size, createdAt: mtime };
}

export async function listBackups(): Promise<BackupInfo[]> {
  if (!existsSync(backupsDir())) return [];
  const names = (await readdir(backupsDir())).filter((n) => /^lsmd-.+\.db$/.test(n));
  const infos = await Promise.all(
    names.map(async (name) => {
      const file = path.join(backupsDir(), name);
      const { size, mtime } = await stat(file);
      return { file, name, bytes: size, createdAt: mtime };
    })
  );
  return infos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

async function pruneBackups(reason: string): Promise<void> {
  const keep = KEEP[reason];
  if (!keep) return;
  const sameKind = (await listBackups()).filter((b) => b.name.endsWith(`-${reason}.db`));
  for (const old of sameKind.slice(keep)) await rm(old.file, { force: true });
}

/** The newest backup's age in hours, or null when there is none. */
export async function hoursSinceLastBackup(reason: string): Promise<number | null> {
  const newest = (await listBackups()).find((b) => b.name.endsWith(`-${reason}.db`));
  return newest ? (Date.now() - newest.createdAt.getTime()) / 3_600_000 : null;
}

declare global {
  var __lsmdBackupTimer: NodeJS.Timeout | undefined;
}

/**
 * Keeps a daily backup going from inside the site, so the server needs no
 * separate timer: checked every hour, taken when the newest is a day old.
 */
export function scheduleDailyBackups(): void {
  if (globalThis.__lsmdBackupTimer) return;
  const check = async () => {
    try {
      if (!existsSync(databaseFile())) return;
      const age = await hoursSinceLastBackup("daily");
      if (age !== null && age < 23.5) return;
      const backup = await backupDatabase("daily");
      log.info("Daily backup taken", { file: backup.name, kb: Math.round(backup.bytes / 1024) });
    } catch (error) {
      log.error("Daily backup failed", error);
    }
  };
  globalThis.__lsmdBackupTimer = setInterval(check, 60 * 60_000);
  globalThis.__lsmdBackupTimer.unref();
  // Not in the middle of starting up.
  setTimeout(check, 5 * 60_000).unref();
}
