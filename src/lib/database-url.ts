/**
 * Which database the site uses.
 *
 * The site moved from a database added by hand as DATABASE_URL to a Neon
 * database connected through Vercel → Storage. That connection could not
 * reuse the name DATABASE_URL (it was taken), so it was connected with the
 * prefix NEON and its variables are NEON_*. When they exist they win, and
 * DATABASE_URL is then the *old* database — kept so deploys can copy its
 * records across (scripts/deploy-schema.mjs, scripts/copy-database.ts).
 *
 * Without NEON_* this is plain DATABASE_URL, as before. Keep the lists in
 * step with scripts/deploy-schema.mjs, which cannot import this file.
 */

/** Pooled addresses, for the app. The names Vercel's Neon connection may use with the NEON prefix. */
const NEON_POOLED = ["NEON_URL", "NEON_DATABASE_URL", "NEON_POSTGRES_PRISMA_URL", "NEON_POSTGRES_URL"];
/** Direct addresses, for schema changes — those can stall on a pooled connection. */
const NEON_DIRECT = ["NEON_URL_UNPOOLED", "NEON_DATABASE_URL_UNPOOLED", "NEON_POSTGRES_URL_NON_POOLING"];

function first(names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

/** The connection the app queries through. */
export function databaseUrl(): string | undefined {
  return first(NEON_POOLED) ?? process.env.DATABASE_URL;
}

/** The connection for `prisma db push` and other schema work. */
export function directDatabaseUrl(): string | undefined {
  if (first(NEON_POOLED)) return first(NEON_DIRECT) ?? first(NEON_POOLED);
  return first(["DIRECT_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "DATABASE_URL"]);
}

/** The database being moved away from, when a move is under way. */
export function oldDatabaseUrl(): string | undefined {
  return process.env.OLD_DATABASE_URL || (first(NEON_POOLED) ? process.env.DATABASE_URL : undefined);
}
