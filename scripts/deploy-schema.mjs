import { execSync } from "node:child_process";

/**
 * Applies prisma/schema.prisma to the database during a deploy.
 *
 * This project has no migrations — schema changes only reach a database when
 * someone runs `prisma db push`. That step kept being missed, so new models
 * shipped as code while the tables never existed, and the pages backed by them
 * failed at runtime (Shift, IncidentReport, AuditLog, SopDocument all hit this).
 *
 * Runs from postinstall as well as build, because a deployment whose build
 * command is overridden in the host's dashboard never runs the `build` script,
 * and postinstall still fires there.
 *
 * Deliberately never fails the deploy. A failure here means the schema did not
 * apply, which the app now survives — the SOP route falls back to the legacy
 * table. Breaking the deploy instead would leave the previous, equally broken
 * build serving traffic, which is strictly worse.
 */

const onCI =
  process.env.VERCEL === "1" ||
  process.env.CI === "1" ||
  process.env.CI === "true";

/**
 * Which database to apply the schema to — the same choice as
 * src/lib/database-url.ts, which this file cannot import. With Vercel's Neon
 * connection (NEON_*) present it wins, and DATABASE_URL is pointed at it for
 * every step this script runs.
 */
const NEON_POOLED = ["NEON_URL", "NEON_DATABASE_URL", "NEON_POSTGRES_PRISMA_URL", "NEON_POSTGRES_URL"];
const NEON_DIRECT = ["NEON_URL_UNPOOLED", "NEON_DATABASE_URL_UNPOOLED", "NEON_POSTGRES_URL_NON_POOLING"];
const firstSet = (names) => names.map((n) => process.env[n]?.trim()).find(Boolean);
const neonUrl = firstSet(NEON_POOLED);
const directUrl = neonUrl
  ? firstSet(NEON_DIRECT) || neonUrl
  : firstSet(["DIRECT_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "DATABASE_URL"]);
if (neonUrl) {
  console.log("[deploy-schema] Using the Neon database (NEON_*).");
  process.env.DATABASE_URL = neonUrl;
}

if (process.env.SKIP_DB_PUSH === "1") {
  console.log("[deploy-schema] SKIP_DB_PUSH=1 — skipping schema push.");
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  if (onCI) {
    console.warn(
      "\n[deploy-schema] ==================================================\n" +
        "[deploy-schema] DATABASE_URL is NOT available to this build.\n" +
        "[deploy-schema] The schema was NOT applied. Tables added in this\n" +
        "[deploy-schema] release will not exist and their pages will fail.\n" +
        "[deploy-schema]\n" +
        "[deploy-schema] Vercel: Settings -> Environment Variables -> DATABASE_URL\n" +
        "[deploy-schema] must be enabled for Production and Preview. Then redeploy,\n" +
        "[deploy-schema] or run `npm run db:push` against the database yourself.\n" +
        "[deploy-schema] ==================================================\n"
    );
  } else {
    console.log("[deploy-schema] DATABASE_URL not set — skipping schema push (local build).");
  }
  process.exit(0);
}

/**
 * Runs one deploy step with a time limit. Without one, a database that never
 * answers (a pooled connection the schema engine stalls on, a lock held by an
 * earlier build that was cancelled) hangs the whole deploy at this line with
 * no error. stdin is closed so a prompt fails at once instead of waiting.
 * Throws on failure or timeout, like execSync.
 */
function run(command, timeoutMs) {
  try {
    execSync(command, {
      stdio: ["ignore", "inherit", "inherit"],
      timeout: timeoutMs,
      killSignal: "SIGKILL",
    });
  } catch (error) {
    if (error?.code === "ETIMEDOUT" || error?.signal === "SIGKILL") {
      console.warn(`[deploy-schema] "${command}" did not finish within ${timeoutMs / 1000}s and was stopped.`);
    }
    throw error;
  }
}

const usingDirectUrl = !!directUrl && directUrl !== process.env.DATABASE_URL;
console.log(
  `[deploy-schema] Applying prisma/schema.prisma to the database (${
    usingDirectUrl ? "direct connection" : "DATABASE_URL"
  })...`
);

try {
  // No --skip-generate: Prisma 7 removed it, and passing it makes the command
  // exit immediately with "unknown or unexpected option".
  run("npx prisma db push", 3 * 60 * 1000);
  console.log("[deploy-schema] Schema is up to date.");
  grantNewPermissions();
  renameRanks();
  backfillPromotionHistory();
} catch {
  // `db push` without --accept-data-loss refuses destructive changes rather
  // than performing them, so this also covers "would drop a column/table".
  console.warn(
    "\n[deploy-schema] ==================================================\n" +
      "[deploy-schema] Schema push FAILED. Tables added in this release may\n" +
      "[deploy-schema] not exist. The deploy was allowed to continue.\n" +
      "[deploy-schema]\n" +
      "[deploy-schema] If it timed out and DATABASE_URL is a pooled address\n" +
      "[deploy-schema] (port 6543, or \"pooler\"/\"pgbouncer\" in it), add the\n" +
      "[deploy-schema] database's direct address as DIRECT_URL in Vercel ->\n" +
      "[deploy-schema] Settings -> Environment Variables, then redeploy.\n" +
      "[deploy-schema]\n" +
      "[deploy-schema] If this is a destructive change (a dropped column or\n" +
      "[deploy-schema] table), apply it deliberately with\n" +
      "[deploy-schema]   npx prisma db push --accept-data-loss\n" +
      "[deploy-schema] If the database is unreachable from the build, run\n" +
      "[deploy-schema]   npm run db:push\n" +
      "[deploy-schema] against it yourself.\n" +
      "[deploy-schema] ==================================================\n"
  );
}

/**
 * Adds permissions introduced in a release to the roles already in the
 * database — once per grant, additively (see scripts/grant-permissions.ts).
 * Never fails the deploy; re-run by hand with `npm run db:grant-permissions`.
 */
function grantNewPermissions() {
  try {
    run("npx tsx scripts/grant-permissions.ts", 60 * 1000);
  } catch {
    console.warn("[deploy-schema] Permission grant failed — run `npm run db:grant-permissions` by hand.");
  }
}

/**
 * Moves members and settings off rank names retired in RANKS onto their new
 * names (scripts/rename-ranks.ts). Never fails the deploy; re-run by hand with
 * `npm run db:rename-ranks`.
 */
function renameRanks() {
  try {
    run("npx tsx scripts/rename-ranks.ts", 60 * 1000);
  } catch {
    console.warn("[deploy-schema] Rank rename failed — run `npm run db:rename-ranks` by hand.");
  }
}

/**
 * Copies promotions made before Promotion History existed into it. Safe on
 * every deploy: it skips anything already copied, so after the first run it
 * finds nothing to do. Never fails the deploy — the history is a convenience,
 * and the script can be re-run by hand with `npm run db:backfill-promotions`.
 */
function backfillPromotionHistory() {
  try {
    run("npx tsx scripts/backfill-promotion-history.ts", 60 * 1000);
  } catch {
    console.warn("[deploy-schema] Promotion history backfill failed — run `npm run db:backfill-promotions` by hand.");
  }
}
