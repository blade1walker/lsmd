import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = (() => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
})();

async function main() {
  const existing = await prisma.adminRole.findFirst({ where: { name: "HR Assistant" } });
  if (!existing) {
    await prisma.adminRole.create({
      data: {
        name: "HR Assistant",
        permissions: [
          "roster.view",
          "hr.view",
          "hr.loa",
          "hr.inactivity",
          "hr.inactivity.approve",
          "removal.request",
          "onboarding.view",
          "onboarding.approve",
        ],
      },
    });
    console.log("Created HR Assistant role");
  } else {
    console.log("HR Assistant role already exists");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
