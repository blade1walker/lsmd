import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ROLE_PRESETS } from "../src/lib/role-presets";

const prisma = (() => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
})();

async function main() {
  for (const preset of ROLE_PRESETS) {
    const existing = await prisma.adminRole.findUnique({ where: { name: preset.name } });

    if (existing) {
      await prisma.adminRole.update({
        where: { id: existing.id },
        data: { permissions: preset.permissions },
      });
      console.log(`Updated ${preset.name} (${preset.permissions.length} permissions)`);
    }

    // An older name for the same role. Rename in place so admin users assigned
    // to it keep their access instead of being orphaned by a create+delete.
    const alias = existing
      ? null
      : await prisma.adminRole.findFirst({ where: { name: { in: preset.aliases ?? [] } } });

    if (alias) {
      await prisma.adminRole.update({
        where: { id: alias.id },
        data: { name: preset.name, permissions: preset.permissions },
      });
      console.log(`Renamed ${alias.name} -> ${preset.name} (${preset.permissions.length} permissions)`);
      continue;
    }

    if (!existing) {
      await prisma.adminRole.create({
        data: { name: preset.name, permissions: preset.permissions },
      });
      console.log(`Created ${preset.name} (${preset.permissions.length} permissions)`);
      continue;
    }

    // Canonical and alias both present: move users onto the canonical role so
    // the duplicate is left empty and safe to delete from /admin/roles.
    for (const aliasName of preset.aliases ?? []) {
      const duplicate = await prisma.adminRole.findUnique({ where: { name: aliasName } });
      if (!duplicate) continue;

      const moved = await prisma.adminUser.updateMany({
        where: { roleId: duplicate.id },
        data: { roleId: existing.id },
      });
      console.log(
        `  Note: "${aliasName}" also exists. Moved ${moved.count} admin user(s) to ${preset.name}. ` +
          `Delete the now-empty "${aliasName}" role from /admin/roles.`
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
