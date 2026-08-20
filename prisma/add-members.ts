import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = (() => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
})();

const members = [
  { name: "Karan Sharma", stateId: "1379", discordId: "598453613324533781", rank: "Paramedic", sectionName: "Patrol" },
  { name: "Stuart", stateId: "1035", discordId: "452122294018637834", rank: "Paramedic", sectionName: "Patrol" },
  { name: "Dr. Chandru Shubhaskar", stateId: "1095", discordId: "897920749598306354", rank: "Paramedic", sectionName: "Patrol" },
  { name: "Naveen Sikhera", stateId: "1187", discordId: "801894165964259398", rank: "Paramedic", sectionName: "Patrol" },
  { name: "HiiCROW Singh", stateId: "1774", discordId: "806750891017371648", rank: "EMT", sectionName: "Patrol" },
  { name: "Shivam Ganguly", stateId: "1091", discordId: "730744388153770075", rank: "Paramedic", sectionName: "Patrol" },
  { name: "Naitik Singhania", stateId: null, discordId: "710860995265822821", rank: "EMT", sectionName: "Patrol" },
  { name: "Patrick Bateman", stateId: "1094", discordId: "1236913650724241509", rank: "Paramedic", sectionName: "Patrol" },
  { name: "Sami Khan", stateId: "1463", discordId: "751420288859897926", rank: "Paramedic", sectionName: "Patrol" },
  { name: "Shambhu D'Souza", stateId: "1368", discordId: "553924997106630711", rank: "Paramedic", sectionName: "Patrol" },
  { name: "Shaana Screwvala", stateId: "1180", discordId: "1063013457215094794", rank: "Paramedic", sectionName: "Patrol" },
  { name: "Rusty Johnson", stateId: "1591", discordId: "836955999046074433", rank: "EMT", sectionName: "Patrol" },
  { name: "Devon Pravesh", stateId: "1552", discordId: "743374516037746759", rank: "Paramedic", sectionName: "Patrol" },
  { name: "Anastasya Snezhnaya", stateId: "1522", discordId: "512694815473926145", rank: "Paramedic", sectionName: "Patrol" },
];

async function main() {
  console.log("Adding members...");

  const patrolSection = await prisma.section.findFirst({ where: { name: "Patrol" } });
  if (!patrolSection) {
    console.error("Patrol section not found!");
    process.exit(1);
  }

  let added = 0;
  let updated = 0;

  for (const m of members) {
    const existing = await prisma.member.findFirst({ where: { discordId: m.discordId } });

    if (existing) {
      await prisma.member.update({
        where: { id: existing.id },
        data: { stateId: m.stateId ?? undefined },
      });
      console.log(`  Updated: ${m.name} (${m.discordId})`);
      updated++;
    } else {
      await prisma.member.create({
        data: {
          name: m.name,
          rank: m.rank,
          dept: "LSMD",
          activity: "Active",
          discordId: m.discordId,
          stateId: m.stateId ?? undefined,
          sectionId: patrolSection.id,
          dateOfJoining: new Date("2026-08-15"),
        },
      });
      console.log(`  Added: ${m.name} (${m.discordId})`);
      added++;
    }
  }

  console.log(`\nDone! Added: ${added}, Updated: ${updated}`);
}

main()
  .catch((e) => {
    console.error("Failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
