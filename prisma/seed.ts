import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ROLE_PRESETS } from "../src/lib/role-presets";

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
            "shifts.view", "shifts.manage",
            "incidents.view", "incidents.manage",
            "audit.view", "roles.manage",
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
      data: [
        { code: "10-4", description: "Acknowledged / OK", section: "ten", order: 0 },
        { code: "10-6", description: "Busy", section: "ten", order: 1 },
        { code: "10-7", description: "Out of Service", section: "ten", order: 2 },
        { code: "10-8", description: "In Service", section: "ten", order: 3 },
        { code: "10-9", description: "Repeat", section: "ten", order: 4 },
        { code: "10-10", description: "Off Duty", section: "ten", order: 5 },
        { code: "10-12", description: "Standby", section: "ten", order: 6 },
        { code: "10-20", description: "Location", section: "ten", order: 7 },
        { code: "10-22", description: "Disregard", section: "ten", order: 8 },
        { code: "10-50", description: "Accident", section: "ten", order: 9 },
        { code: "10-52", description: "Medical Emergency", section: "ten", order: 10, highlighted: true },
        { code: "10-54", description: "Livestock on Roadway", section: "ten", order: 11 },
        { code: "10-76", description: "En Route", section: "ten", order: 12 },
        { code: "10-97", description: "Check Signal / Radio Test", section: "ten", order: 13 },
        { code: "10-99", description: "Emergency / Officer Down", section: "ten", order: 14, highlighted: true },
        { code: "CODE 4", description: "No Further Assistance Needed", section: "code", order: 15 },
        { code: "CODE 3", description: "Emergency Response (Lights & Sirens)", section: "code", order: 16, highlighted: true },
      ],
    });
    console.log("  Created 17 radio codes");
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
