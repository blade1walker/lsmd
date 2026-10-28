import "dotenv/config";
import { backupDatabase, listBackups } from "../src/lib/backup";

/**
 * Takes a verified backup of the database while the site keeps running.
 *
 *   npm run db:backup            # DATA_DIR/backups/lsmd-<when>-manual.db
 *   npm run db:backup -- --list  # what is there
 *
 * The site also backs itself up once a day, and every deploy backs up
 * before it changes anything.
 */

async function main() {
  if (process.argv.includes("--list")) {
    for (const b of await listBackups()) {
      console.log(`${b.name.padEnd(48)} ${String(Math.round(b.bytes / 1024)).padStart(7)} KB  ${b.createdAt.toISOString()}`);
    }
    return;
  }
  const backup = await backupDatabase("manual");
  console.log(`Backed up and verified: ${backup.file}`);
}

main().catch((error) => {
  console.error(`Backup failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
