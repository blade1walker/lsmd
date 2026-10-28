import "dotenv/config";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { backupDatabase } from "../src/lib/backup";
import { applyMigrations } from "../src/lib/migrations";
import { dataDir, databaseFile } from "../src/lib/paths";

/**
 * Development only: starts the local database over, with the seed data.
 * The old one is backed up first. Refused when NODE_ENV=production.
 *
 *   npm run db:reset
 */

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("db:reset is for development databases only.");
    process.exit(1);
  }
  const file = databaseFile();
  if (existsSync(file)) {
    const backup = await backupDatabase("manual");
    console.log(`Old database saved as ${backup.name}.`);
  }
  await Promise.all([file, `${file}-wal`, `${file}-shm`, path.join(dataDir(), "MOVED-TO-SQLITE.json")].map((f) => rm(f, { force: true })));
  applyMigrations(file);
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "inherit" });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
