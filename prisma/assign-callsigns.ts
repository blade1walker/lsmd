import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = (() => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
})();

const RANK_CALLSIGN: Record<string, { fixed?: number; start: number; end: number }> = {
  "Director of Medicine": { fixed: 999 },
  "Director of EMS": { fixed: 900 },
  "Chief of EMS": { fixed: 911 },
  "Deputy Chief of EMS": { fixed: 912 },
  "Assistant Chief": { fixed: 913 },
  "Division Chief": { fixed: 914 },
  "EMS Captain": { fixed: 915 },
  "Lieutenant": { start: 920, end: 929 },
  "Senior Paramedic": { start: 930, end: 949 },
  "Paramedic": { start: 950, end: 969 },
  "EMT": { start: 970, end: 979 },
  "EMR": { start: 980, end: 989 },
  "Medical Intern": { start: 990, end: 998 },
};

async function main() {
  const members = await prisma.member.findMany({ orderBy: [{ rank: "asc" }, { name: "asc" }] });
  const counters: Record<string, number> = {};

  for (const m of members) {
    const range = RANK_CALLSIGN[m.rank];
    if (!range) {
      console.log(`  ${m.name} (${m.rank}) → no call sign range defined, skipping`);
      continue;
    }

    let callsign: string;
    if (range.fixed) {
      callsign = String(range.fixed);
    } else {
      const key = `${range.start}-${range.end}`;
      if (!(key in counters)) counters[key] = range.start;
      callsign = String(counters[key]);
      counters[key]++;
    }

    await prisma.member.update({
      where: { id: m.id },
      data: { callSign: callsign },
    });
    console.log(`  ${m.name} (${m.rank}) → ${callsign}`);
  }

  console.log("\nDone!");
}

main()
  .catch((e) => { console.error("Failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
