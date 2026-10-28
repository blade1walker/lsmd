import path from "node:path";

/**
 * Where the site keeps what it writes while running: the database, its
 * backups and uploaded images, all under DATA_DIR (default ./data).
 *
 * On the Oracle VM each release folder links ./data to /opt/lsmd/data, so
 * deploys never touch it; with Docker it is a volume. Imported with relative
 * paths only, because prisma.config.ts and the deploy scripts load it too.
 */

export function dataDir(): string {
  // Runtime data, not part of the build: kept out of Turbopack's file tracing.
  return path.resolve(/* turbopackIgnore: true */ process.env.DATA_DIR?.trim() || path.join(process.cwd(), "data"));
}

/** The SQLite database file. DATABASE_FILE overrides it, e.g. for tests. */
export function databaseFile(): string {
  return path.resolve(/* turbopackIgnore: true */ process.env.DATABASE_FILE?.trim() || path.join(dataDir(), "lsmd.db"));
}

export function backupsDir(): string {
  return path.join(dataDir(), "backups");
}

export function uploadsDir(): string {
  return path.join(dataDir(), "uploads");
}
