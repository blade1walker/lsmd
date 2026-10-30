import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseUrl } from "../src/lib/db/database-url";

/**
 * Creates roster sections that members can be moved into by hand but that no
 * rank leads to, so nothing else would ever create them. Each goes after the
 * existing sections, which are left as they are. Safe on every deploy: once a
 * section exists this changes nothing. Run by scripts/deploy-schema.mjs; by hand
 * with `npm run db:ensure-sections`.
 */
const SECTIONS = ["FTP"];

const prisma = (() => {
  const adapter = new PrismaPg({ connectionString: databaseUrl()! });
  return new PrismaClient({ adapter });
})();

async function main() {
  for (const name of SECTIONS) {
    if (await prisma.section.findFirst({ where: { name } })) {
      console.log(`[ensure-sections] ${name}: already exists`);
      continue;
    }
    const last = await prisma.section.aggregate({ _max: { order: true } });
    await prisma.section.create({ data: { name, order: (last._max.order ?? -1) + 1 } });
    console.log(`[ensure-sections] ${name}: created`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
