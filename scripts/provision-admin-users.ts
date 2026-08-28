import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SUPER_ADMIN_IDS } from "../src/lib/constants";
import { DEFAULT_MEMBER_ROLE } from "../src/lib/role-presets";
import { memberDisplayLabel } from "../src/lib/utils";

/**
 * One-time backfill for existing roster members: creates their AdminUser row
 * now, instead of waiting for each of them to log in again before they show
 * up in /admin/roles' Admin Users list. lib/access.ts's provisionAdminUser
 * does the same thing per-login going forward — this just catches everyone
 * who already had access before that shipped.
 *
 * Safe to re-run: skips anyone who already has a row (assigned explicitly,
 * provisioned by an earlier login, or by a previous run of this script).
 */

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env or export it, then re-run.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const defaultRole = await prisma.adminRole.findUnique({ where: { name: DEFAULT_MEMBER_ROLE } });
  if (!defaultRole) {
    console.error(`"${DEFAULT_MEMBER_ROLE}" role does not exist yet. Run \`npm run db:seed-roles\` first.`);
    process.exit(1);
  }

  const members = await prisma.member.findMany({
    where: { discordId: { not: null } },
    select: { name: true, callSign: true, discordId: true },
  });

  const existingIds = new Set(
    (await prisma.adminUser.findMany({ select: { discordId: true } })).map((u) => u.discordId)
  );

  const toProvision = members.filter(
    (m) => m.discordId && !existingIds.has(m.discordId) && !SUPER_ADMIN_IDS.includes(m.discordId)
  );

  if (toProvision.length === 0) {
    console.log("Nothing to provision — every linked roster member already has an AdminUser row.");
    return;
  }

  for (const member of toProvision) {
    await prisma.adminUser.create({
      data: {
        discordId: member.discordId!,
        discordName: memberDisplayLabel(member),
        roles: { connect: { id: defaultRole.id } },
      },
    });
    console.log(`Provisioned ${memberDisplayLabel(member)}`);
  }

  console.log(`\nProvisioned ${toProvision.length} admin user(s) on "${DEFAULT_MEMBER_ROLE}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
