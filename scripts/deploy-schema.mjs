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

console.log("[deploy-schema] Applying prisma/schema.prisma to the database...");

try {
  // No --skip-generate: Prisma 7 removed it, and passing it makes the command
  // exit immediately with "unknown or unexpected option".
  execSync("npx prisma db push", { stdio: "inherit" });
  console.log("[deploy-schema] Schema is up to date.");
} catch {
  // `db push` without --accept-data-loss refuses destructive changes rather
  // than performing them, so this also covers "would drop a column/table".
  console.warn(
    "\n[deploy-schema] ==================================================\n" +
      "[deploy-schema] Schema push FAILED. Tables added in this release may\n" +
      "[deploy-schema] not exist. The deploy was allowed to continue.\n" +
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
