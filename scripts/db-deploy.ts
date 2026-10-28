import "dotenv/config";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { backupDatabase } from "../src/lib/backup";
import { applyMigrations } from "../src/lib/migrations";
import { dataDir, databaseFile } from "../src/lib/paths";
import { describeUrl, importFromPostgres, postgresSourceUrl, writeMovedMarker } from "./lib/postgres-transfer";

/**
 * Gets the database ready for the release being deployed. Run by
 * scripts/deploy-schema.mjs on every deploy (deploy/oracle/deploy.sh,
 * deploy/start.sh), and by hand with `npm run db:migrate`.
 *
 * 1. No database yet:
 *    - this server has moved to SQLite before → stop: the file has gone
 *      missing, and silently starting over (or re-importing old data) would
 *      lose everything since. Restore a backup instead.
 *    - an old Postgres database is configured → copy it in, verified
 *      (scripts/lib/postgres-transfer.ts). It is only read, never changed,
 *      so it stays as it was — the way back if this release is rolled back.
 *    - neither → a new, empty database (a fresh install).
 * 2. A database already → a verified backup before anything changes it.
 * 3. Apply new migrations, each one all or nothing.
 * 4. Data updates that ship with a release: permission grants, rank
 *    renames, promotion history. These never fail the deploy.
 *
 * Exits non-zero when 1–3 fail, which stops the deploy before the new
 * release goes live; the previous one keeps serving.
 */

const MARKER = path.join(dataDir(), "MOVED-TO-SQLITE.json");

function step(name: string, script: string) {
  try {
    execFileSync("npx", ["tsx", script], { stdio: ["ignore", "inherit", "inherit"], timeout: 120_000 });
  } catch {
    console.warn(`[db] ${name} failed — run \`npx tsx ${script}\` by hand.`);
  }
}

async function main() {
  const file = databaseFile();
  console.log(`[db] Database: ${file}`);

  if (!existsSync(file)) {
    if (existsSync(MARKER)) {
      throw new Error(
        `The database file is missing, but this server already moved to SQLite (${MARKER}).\n` +
          "Restore the newest backup instead of starting empty: npm run db:restore -- --latest"
      );
    }
    const source = postgresSourceUrl();
    if (source) {
      console.log(`[db] First start on SQLite: copying ${describeUrl(source)} into ${file} …`);
      const started = Date.now();
      const counts = await importFromPostgres(source, file, (line) => console.log(`[db] ${line}`));
      const rows = counts.reduce((sum, c) => sum + c.rows, 0);
      console.log(`[db] Copied and verified ${rows} rows in ${counts.length} tables (${Math.round((Date.now() - started) / 1000)} s).`);
      await writeMovedMarker(MARKER, { from: describeUrl(source), rows, tables: Object.fromEntries(counts.map((c) => [c.table, c.rows])) });
      console.log("[db] The old database was only read and is unchanged.");
    } else {
      console.log("[db] No database yet and no old one to copy — starting a new, empty one.");
    }
  } else {
    const backup = await backupDatabase("deploy");
    console.log(`[db] Backed up to ${backup.name} (${Math.round(backup.bytes / 1024)} KB).`);
  }

  const applied = applyMigrations(file);
  console.log(applied.length ? `[db] Applied migrations: ${applied.join(", ")}` : "[db] Schema is up to date.");
  if (!existsSync(MARKER)) await writeMovedMarker(MARKER, { from: null });

  step("Permission grants", "scripts/grant-permissions.ts");
  step("Rank renames", "scripts/rename-ranks.ts");
  step("Promotion history backfill", "scripts/backfill-promotion-history.ts");
}

main().catch((error) => {
  console.error(`\n[db] ${error instanceof Error ? error.message : error}\n[db] The deploy stops here; the running release is untouched.`);
  process.exit(1);
});
