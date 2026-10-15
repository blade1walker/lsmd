import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Hands permissions added in a release to the roles that already exist.
 *
 * A new permission reaches nobody on its own: roles live in the database, and
 * the presets in role-presets.ts only shape roles when they are first created.
 * `db:seed-roles` would fix that, but it overwrites each preset role's list
 * wholesale — wiping anything an admin changed on the Roles page.
 *
 * So each grant here only ever adds, and each is applied exactly once: the
 * audit log entry it writes is the marker. After that, an admin who removes
 * one of these permissions from a role keeps it removed on every later deploy.
 * A role missing from this database is skipped.
 */
const GRANTS: { id: string; roles: Record<string, string[]> }[] = [
  {
    id: "2026-09-22-trainees-promotions",
    roles: {
      "Super Admin": ["trainees.view", "promotions.view"],
      "Roster Admin": ["trainees.view", "promotions.view"],
      "Assistant HR": ["trainees.view", "promotions.view"],
      "HR Admin": ["trainees.view", "promotions.view"],
      "Training Admin": ["trainees.view"],
      FTP: ["trainees.view"],
    },
  },
  {
    id: "2026-09-23-promotion-interviews",
    roles: {
      // Everything, including the thresholds and the announcement channel.
      "Super Admin": [
        "interviews.view",
        "interviews.create",
        "interviews.score",
        "interviews.finalize",
        "interviews.manage",
      ],
      "Roster Admin": [
        "interviews.view",
        "interviews.create",
        "interviews.score",
        "interviews.finalize",
        "interviews.manage",
      ],
      // HR runs promotion examinations end to end but does not set the
      // thresholds — that stays with the roles above.
      "HR Admin": ["interviews.view", "interviews.create", "interviews.score", "interviews.finalize"],
      // Assistant HR sits on panels and reads the records.
      "Assistant HR": ["interviews.view", "interviews.score"],
      "Training Admin": ["interviews.view", "interviews.score"],
      FTP: ["interviews.view", "interviews.score"],
    },
  },
  {
    id: "2026-09-23-interview-review-readiness-analytics",
    roles: {
      // Management review, the readiness board, analytics and the PDF report
      // go to the roles that already run examinations end to end.
      "Super Admin": ["interviews.review", "interviews.readiness", "interviews.analytics", "interviews.export"],
      "Roster Admin": ["interviews.review", "interviews.readiness", "interviews.analytics", "interviews.export"],
      "HR Admin": ["interviews.review", "interviews.readiness", "interviews.analytics", "interviews.export"],
      // Panel-only roles see who is coming up for promotion, nothing more.
      "Assistant HR": ["interviews.readiness"],
      "Training Admin": ["interviews.readiness"],
      FTP: ["interviews.readiness"],
    },
  },
  {
    id: "2026-10-13-bot-permissions",
    roles: {
      // The Bot Permissions page shipped with no role holding it, so only
      // super admins could open it or give anyone access to bot commands.
      "Super Admin": ["bot.permissions.view", "bot.permissions.manage"],
      "Roster Admin": ["bot.permissions.view", "bot.permissions.manage"],
    },
  },
  {
    id: "2026-10-14-city-link-duty-board-activity",
    roles: {
      // The roles that run the roster run the FiveM link, the Duty Board and
      // the activity requirement.
      "Super Admin": ["fivem.view", "fivem.manage", "duty.manage", "activity.view", "activity.manage"],
      "Roster Admin": ["fivem.view", "fivem.manage", "duty.manage", "activity.view", "activity.manage"],
      // HR follows activity up, so it sets the requirement and can check who
      // was really in the city — but does not reconfigure the link.
      "HR Admin": ["fivem.view", "activity.view", "activity.manage"],
      "Assistant HR": ["activity.view"],
      "Training Admin": ["activity.view"],
    },
  },
  {
    id: "2026-10-15-loa-section",
    roles: {
      // HR and Assistant HR run leave; roles ranked above them inherit it
      // through the role hierarchy.
      "Super Admin": ["loa.view", "loa.manage"],
      "HR Admin": ["loa.view", "loa.manage"],
      "Assistant HR": ["loa.view", "loa.manage"],
    },
  },
];

const prisma = (() => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
})();

async function main() {
  for (const grant of GRANTS) {
    const applied = await prisma.auditLog.findFirst({
      where: { entityType: "PermissionGrant", entityId: grant.id },
      select: { id: true },
    });
    if (applied) {
      console.log(`[grant-permissions] ${grant.id}: already applied`);
      continue;
    }

    const changes: Record<string, string[]> = {};
    for (const [roleName, permissions] of Object.entries(grant.roles)) {
      const role = await prisma.adminRole.findUnique({ where: { name: roleName } });
      if (!role) continue;
      const missing = permissions.filter((p) => !role.permissions.includes(p));
      if (missing.length === 0) continue;
      await prisma.adminRole.update({
        where: { id: role.id },
        data: { permissions: [...role.permissions, ...missing] },
      });
      changes[roleName] = missing;
      console.log(`[grant-permissions] ${roleName}: + ${missing.join(", ")}`);
    }

    await prisma.auditLog.create({
      data: {
        action: "grant",
        entityType: "PermissionGrant",
        entityId: grant.id,
        entityLabel: `Permission grant ${grant.id}`,
        details: changes,
        performedBy: "System (deploy)",
      },
    });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
