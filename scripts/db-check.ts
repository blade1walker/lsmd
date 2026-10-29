import "dotenv/config";
import { existsSync, statSync } from "node:fs";
import Database from "better-sqlite3";
import { checkIntegrity, listBackups } from "../src/lib/db/backup";
import { migrationNames } from "../src/lib/db/migrations";
import { databaseFile } from "../src/lib/paths";

/**
 * A read-only health report on the database: is it there, is every page
 * sound, which migrations are applied or waiting, how big each table is and
 * how fresh the newest backup is.
 *
 *   npm run db:check
 */

function main() {
  const file = databaseFile();
  if (!existsSync(file)) {
    console.log(`No database at ${file} yet. npm run db:migrate creates it.`);
    process.exit(1);
  }
  console.log(`Database: ${file} (${Math.round(statSync(file).size / 1024)} KB)`);

  const problem = checkIntegrity(file);
  console.log(problem ? `Integrity: FAILED — ${problem}` : "Integrity: ok");

  const db = new Database(file, { readonly: true });
  try {
    console.log(`Journal mode: ${db.pragma("journal_mode", { simple: true })}`);
    const applied = new Set(
      db.prepare(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`).pluck().all() as string[]
    );
    const waiting = migrationNames().filter((m) => !applied.has(m));
    console.log(`Migrations: ${applied.size} applied${waiting.length ? `, waiting: ${waiting.join(", ")}` : ", none waiting"}`);

    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY name`)
      .pluck()
      .all() as string[];
    for (const t of tables) {
      const n = db.prepare(`SELECT COUNT(*) FROM "${t.replace(/"/g, '""')}"`).pluck().get();
      console.log(`  ${t.padEnd(32)} ${n}`);
    }
  } finally {
    db.close();
  }

  return listBackups().then((backups) => {
    const newest = backups[0];
    console.log(newest ? `Newest backup: ${newest.name}` : "No backups yet — npm run db:backup takes one.");
    if (problem) process.exit(1);
  });
}

main();
