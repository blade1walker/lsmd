import "dotenv/config";
import { databaseFile } from "../src/lib/paths";
import { describeUrl, exportToPostgres, postgresSourceUrl } from "./lib/postgres-transfer";

/**
 * The way back to Postgres after the move to SQLite: copies the SQLite
 * database into a Postgres database that has the old schema — the old Neon
 * database does — replacing what is there, so a release from before the move
 * runs on today's data.
 *
 *   sudo systemctl stop lsmd
 *   npm run db:export-postgres -- --replace                     # into DATABASE_URL / NEON_*
 *   npm run db:export-postgres -- --replace --to postgresql://…
 *
 * Everything in that Postgres database is replaced, in one transaction: it
 * either ends up an exact copy or is left as it was.
 */

async function main() {
  const i = process.argv.indexOf("--to");
  const target = (i >= 0 ? process.argv[i + 1] : undefined) ?? postgresSourceUrl();
  if (!target) {
    console.error("Name the Postgres database: --to postgresql://… (or set DATABASE_URL / NEON_*).");
    process.exit(1);
  }
  if (!process.argv.includes("--replace")) {
    console.error(`This replaces everything in ${describeUrl(target)}. Re-run with --replace to go ahead.`);
    process.exit(1);
  }
  const counts = await exportToPostgres(databaseFile(), target);
  for (const c of counts) console.log(`  ${c.table.padEnd(32)} ${c.rows}`);
}

main().catch((error) => {
  console.error(`Export failed — the Postgres database was left as it was.\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
