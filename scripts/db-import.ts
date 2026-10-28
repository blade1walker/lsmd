import "dotenv/config";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { backupDatabase } from "../src/lib/backup";
import { databaseFile } from "../src/lib/paths";
import { describeUrl, importFromPostgres, postgresSourceUrl } from "./lib/postgres-transfer";

/**
 * Copies a Postgres database (the site's old Neon database) into SQLite —
 * what a deploy does by itself the first time it finds no SQLite database.
 * By hand, to try the move on a copy or to repeat it:
 *
 *   npm run db:import                                   # from DATABASE_URL / NEON_*
 *   npm run db:import -- --from postgresql://…          # from another one
 *   npm run db:import -- --replace                      # over an existing SQLite database (backed up first)
 *
 * The Postgres database is only read. The site should be stopped for
 * --replace, so nothing it writes meanwhile is lost.
 */

async function main() {
  const i = process.argv.indexOf("--from");
  const source = (i >= 0 ? process.argv[i + 1] : undefined) ?? postgresSourceUrl();
  if (!source) {
    console.error("No Postgres database to copy: set DATABASE_URL (or NEON_*) or pass --from <url>.");
    process.exit(1);
  }
  const target = databaseFile();
  if (existsSync(target)) {
    if (!process.argv.includes("--replace")) {
      console.error(`${target} already exists. Pass --replace to back it up and replace it.`);
      process.exit(1);
    }
    const backup = await backupDatabase("pre-restore");
    console.log(`Existing database saved as ${backup.name}.`);
    await Promise.all([target, `${target}-wal`, `${target}-shm`].map((f) => rm(f, { force: true })));
  }
  console.log(`Copying ${describeUrl(source)} into ${target} …`);
  const counts = await importFromPostgres(source, target);
  for (const c of counts) console.log(`  ${c.table.padEnd(32)} ${c.rows}`);
  console.log(`Done: ${counts.reduce((s, c) => s + c.rows, 0)} rows copied and verified.`);
}

main().catch((error) => {
  console.error(`Import failed — nothing was changed.\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
