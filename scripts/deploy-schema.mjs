import { execSync } from "node:child_process";

/**
 * Applies prisma/schema.prisma to the database as part of the build.
 *
 * This project has no migrations — schema changes only reach a database when
 * someone runs `prisma db push` by hand. That step kept being missed, so new
 * models shipped as code while the tables never existed, and the pages backed
 * by them failed at runtime with "table does not exist" (Shift, IncidentReport,
 * AuditLog, SopDocument have all hit this).
 *
 * Running it here means a deploy can no longer land code that its database
 * cannot serve.
 *
 * `db push` without --accept-data-loss refuses destructive changes rather than
 * performing them, so a schema edit that would drop a column or table fails the
 * build instead of quietly destroying data.
 */

if (process.env.SKIP_DB_PUSH === "1") {
  console.log("[deploy-schema] SKIP_DB_PUSH=1 — skipping schema push.");
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  // Expected for local builds with no database configured. Deployments always
  // have it set, so this branch does not hide the problem it is meant to solve.
  console.log("[deploy-schema] DATABASE_URL not set — skipping schema push.");
  process.exit(0);
}

console.log("[deploy-schema] Applying prisma/schema.prisma to the database...");

try {
  execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
  console.log("[deploy-schema] Schema is up to date.");
} catch {
  console.error(
    "\n[deploy-schema] Schema push failed, so the build was stopped before it could\n" +
      "deploy code the database cannot serve.\n\n" +
      "If this is a destructive change (a dropped column or table), apply it\n" +
      "deliberately with `npx prisma db push --accept-data-loss` against the\n" +
      "database, then redeploy.\n\n" +
      "If the database is simply unreachable from the build environment, set\n" +
      "SKIP_DB_PUSH=1 and run `npm run db:push` yourself instead.\n"
  );
  process.exit(1);
}
