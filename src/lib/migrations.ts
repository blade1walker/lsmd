import { createHash, randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * Applies prisma/migrations to the SQLite database on deploy.
 *
 * The migrations are Prisma's own (written with `npm run db:migration`), and
 * applied ones are recorded in Prisma's `_prisma_migrations` table, so
 * `prisma migrate status` reads the same history. This runner is used instead
 * of `prisma migrate deploy` on the server because that needs Prisma's native
 * schema engine built for the server's exact platform, and because it can
 * apply each migration more safely than SQLite allows from inside a script:
 *
 * - each migration runs in one transaction — it applies completely or not
 *   at all;
 * - foreign keys are switched off for it (SQLite ignores that switch inside
 *   a transaction, so it is set before), so rebuilding a table never
 *   cascade-deletes the rows that point at it; every link is checked before
 *   the transaction commits instead.
 */

export const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

const HISTORY_TABLE = `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "checksum" TEXT NOT NULL,
  "finished_at" DATETIME,
  "migration_name" TEXT NOT NULL,
  "logs" TEXT,
  "rolled_back_at" DATETIME,
  "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
  "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0
)`;

interface HistoryRow {
  migration_name: string;
  checksum: string;
  finished_at: string | null;
}

/** Migration folder names, oldest first. */
export function migrationNames(dir = MIGRATIONS_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(dir, d.name, "migration.sql")))
    .map((d) => d.name)
    .sort();
}

const checksumOf = (sql: string) => createHash("sha256").update(sql).digest("hex");

/** Creates the database if needed and applies every migration not yet applied. Returns their names. */
export function applyMigrations(file: string, dir = MIGRATIONS_DIR): string[] {
  const db = new Database(file);
  try {
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    db.pragma("foreign_keys = OFF");
    db.exec(HISTORY_TABLE);

    const history = new Map(
      (db.prepare(`SELECT migration_name, checksum, finished_at FROM "_prisma_migrations" WHERE rolled_back_at IS NULL`).all() as HistoryRow[]).map(
        (r) => [r.migration_name, r]
      )
    );

    const applied: string[] = [];
    for (const name of migrationNames(dir)) {
      const sql = readFileSync(path.join(dir, name, "migration.sql"), "utf8");
      const done = history.get(name);
      if (done) {
        if (!done.finished_at) throw new Error(`Migration ${name} was started and never finished. Restore a backup taken before it.`);
        if (done.checksum !== checksumOf(sql)) console.warn(`[migrations] ${name} was edited after it was applied; the edit is ignored.`);
        continue;
      }
      const startedAt = new Date().toISOString();
      db.transaction(() => {
        db.exec(sql);
        const broken = db.prepare("PRAGMA foreign_key_check").all() as { table: string }[];
        if (broken.length) {
          throw new Error(`Migration ${name} would leave ${broken.length} broken link(s), first in ${broken[0].table}.`);
        }
        db.prepare(
          `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
           VALUES (?, ?, ?, ?, ?, 1)`
        ).run(randomUUID(), checksumOf(sql), new Date().toISOString(), name, startedAt);
      })();
      applied.push(name);
    }
    return applied;
  } finally {
    db.close();
  }
}
