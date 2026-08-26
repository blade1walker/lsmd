import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ROLE_PRESETS } from "../src/lib/role-presets";
import { RADIO_CODES } from "../src/lib/radio-codes";

const prisma = (() => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
})();

async function main() {
  console.log("Seeding database...");

  // Sections
  const sectionCount = await prisma.section.count();
  if (sectionCount === 0) {
    console.log("Creating sections...");
    const sections = [
      { name: "High Command", order: 0 },
      { name: "Command", order: 1 },
      { name: "NCO", order: 2 },
      { name: "Patrol", order: 3 },
      { name: "Probationary", order: 4 },
    ];
    for (const s of sections) {
      await prisma.section.create({ data: s });
    }
    console.log("  Created 5 sections");
  }

  // Admin Roles
  const roleCount = await prisma.adminRole.count();
  if (roleCount === 0) {
    console.log("Creating admin roles...");
    await prisma.adminRole.createMany({
      data: [
        {
          name: "Super Admin",
          permissions: [
            "roster.view", "roster.add", "roster.edit", "roster.delete", "roster.promote",
            "roster.promote.cadet",
            "hr.view", "hr.loa", "hr.inactivity", "hr.inactivity.approve",
            "removal.request", "removal.approve", "removal.ptd.approve",
            "sop.view", "sop.edit",
            "training.view", "training.manage", "training.signoff.manage",
            "clock.view", "notifications", "templates", "radio.edit",
            "onboarding.view", "onboarding.approve",
            "roles.manage",
          ],
        },
        {
          name: "Training Admin",
          permissions: [
            "training.view", "training.manage", "training.signoff.manage",
            "roster.view",
          ],
        },
        {
          name: "HR Admin",
          permissions: [
            "hr.view", "hr.loa", "hr.inactivity", "hr.inactivity.approve",
            "roster.view", "removal.request",
          ],
        },
        {
          name: "Roster Admin",
          permissions: [
            "roster.view", "roster.add", "roster.edit", "roster.promote",
            "roster.promote.cadet",
          ],
        },
        {
          name: "Viewer",
          permissions: ["roster.view"],
        },
        ...ROLE_PRESETS.map((r) => ({ name: r.name, permissions: [...r.permissions] })),
      ],
    });
    console.log("  Created " + (5 + ROLE_PRESETS.length) + " admin roles");
  }

  // Temp Rank Templates
  const trCount = await prisma.tempRankTemplate.count();
  if (trCount === 0) {
    console.log("Creating temp rank templates...");
    await prisma.tempRankTemplate.createMany({
      data: [
        { name: "Acting Chief", order: 0 },
        { name: "Acting Captain", order: 1 },
        { name: "Acting Lieutenant", order: 2 },
      ],
    });
    console.log("  Created 3 temp rank templates");
  }

  // Category Templates
  const catCount = await prisma.categoryTemplate.count();
  if (catCount === 0) {
    console.log("Creating category templates...");
    await prisma.categoryTemplate.createMany({
      data: [
        { name: "Full Time", color: "#eab308", order: 0 },
        { name: "Part Time", color: "#3b82f6", order: 1 },
        { name: "Probationary", color: "#f97316", order: 2 },
        { name: "Inactive", color: "#6b7280", order: 3 },
      ],
    });
    console.log("  Created 4 category templates");
  }

  // SOP Content
  const sopCount = await prisma.sopContent.count();
  if (sopCount === 0) {
    console.log("Creating default SOP...");
    await prisma.sopContent.create({
      data: {
        id: "sop-main",
        content: "# LSMD Standard Operating Procedure\n\nWelcome to the Los Santos Medical Department SOP.\n\n*Edit this content from the Admin Panel > SOP Editor.*",
      },
    });
    console.log("  Created default SOP");
  }

  // Default Radio Codes
  const radioCount = await prisma.radioCode.count();
  if (radioCount === 0) {
    console.log("Creating default radio codes...");
    await prisma.radioCode.createMany({
      data: RADIO_CODES.map((c, i) => ({
        code: c.code,
        description: c.description,
        section: c.section,
        order: i,
        highlighted: c.highlighted ?? false,
      })),
    });
    console.log("  Created " + RADIO_CODES.length + " radio codes");
  }

  // Sign-off Definitions
  const signoffCount = await prisma.signOffDefinition.count();
  if (signoffCount === 0) {
    console.log("Creating sign-off definitions...");
    await prisma.signOffDefinition.createMany({
      data: [
        { name: "CPR Certification", order: 0 },
        { name: "First Aid Certification", order: 1 },
        { name: "AED Certification", order: 2 },
        { name: "Trauma Certification", order: 3 },
      ],
    });
    console.log("  Created 4 sign-off definitions");
  }

  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
