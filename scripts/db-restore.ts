import "dotenv/config";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { backupDatabase, checkIntegrity, copyDatabase, listBackups } from "../src/lib/db/backup";
import { backupsDir, databaseFile } from "../src/lib/paths";

/**
 * Puts a backup back as the site's database.
 *
 *   sudo systemctl stop lsmd                       # the site must be stopped
 *   npm run db:restore -- lsmd-20261028T120000Z-daily.db   # or --latest, or a path
 *   sudo systemctl start lsmd
 *
 * The backup is integrity-checked first, and the current database is itself
 * backed up (…-pre-restore.db) before it is replaced, so a restore can be
 * undone the same way.
 */

async function siteIsRunning(): Promise<boolean> {
  try {
    await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/`, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const latest = process.argv.includes("--latest");
  let source: string | undefined;
  if (latest) source = (await listBackups()).find((b) => !b.name.endsWith("-pre-restore.db"))?.file;
  else if (arg) source = existsSync(arg) ? path.resolve(arg) : path.join(backupsDir(), arg);
  if (!source || !existsSync(source)) {
    console.error("Name a backup (npm run db:backup -- --list shows them), a path to one, or --latest.");
    process.exit(1);
  }
  if (!process.argv.includes("--force") && (await siteIsRunning())) {
    console.error("The site is running. Stop it first (sudo systemctl stop lsmd), then restore and start it again.");
    process.exit(1);
  }

  const problem = checkIntegrity(source);
  if (problem) throw new Error(`${path.basename(source)} failed its integrity check (${problem}); not restoring it.`);

  const target = databaseFile();
  if (existsSync(target)) {
    const safety = await backupDatabase("pre-restore");
    console.log(`Current database saved as ${safety.name}.`);
  }
  await Promise.all([target, `${target}-wal`, `${target}-shm`].map((f) => rm(f, { force: true })));
  await copyDatabase(target, source);
  console.log(`Restored ${path.basename(source)} as ${target}. Start the site again.`);
}

main().catch((error) => {
  console.error(`Restore failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
