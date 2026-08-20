import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = (() => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
})();

async function main() {
  await prisma.section.updateMany({
    where: { name: "Patrol" },
    data: { name: "Medical Patrol" },
  });
  console.log("Renamed Patrol to Medical Patrol");

  const sections = await prisma.section.findMany({ orderBy: { order: "asc" } });
  sections.forEach((s) => console.log(`  ${s.order}. ${s.name}`));
}

main()
  .catch((e) => { console.error("Failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
