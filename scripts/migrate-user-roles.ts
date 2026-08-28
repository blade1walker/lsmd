import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Copies each AdminUser's legacy single roleId into the new multi-role
 * relation, so an assignment made before the multi-role UI shipped is
 * editable there too instead of being invisible.
 *
 * Not required for correctness — resolveAccess() already unions the legacy
 * role with the new roles[] relation, so permissions are unaffected either
 * way. This only makes existing assignments show up and stay editable in the
 * new UI. Safe to re-run: skipped for anyone who already has an entry in
 * roles[], whether from this script or from being assigned there directly.
 */

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env or export it, then re-run.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const users = await prisma.adminUser.findMany({
    where: { roleId: { not: null } },
    include: { role: true, roles: true },
  });

  const toMigrate = users.filter((u) => u.roles.length === 0 && u.role);

  if (toMigrate.length === 0) {
    console.log("Nothing to migrate — no AdminUser has a legacy role outside the new relation.");
    return;
  }

  for (const user of toMigrate) {
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { roles: { connect: { id: user.role!.id } } },
    });
    console.log(`${user.discordName}: added "${user.role!.name}" to their role list`);
  }

  console.log(`\nMigrated ${toMigrate.length} admin user(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
