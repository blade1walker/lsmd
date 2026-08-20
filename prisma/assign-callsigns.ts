import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = (() => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
})();

const HIGH_COMMAND = ["Director of EMS", "Chief of EMS", "Deputy Chief of EMS", "Assistant Chief"];
const COMMAND = ["Division Chief", "EMS Captain", "Lieutenant"];

function getCallSignRange(rank: string): { start: number; end: number } {
  if (HIGH_COMMAND.includes(rank)) return { start: 900, end: 903 };
  if (COMMAND.includes(rank)) return { start: 904, end: 911 };
  return { start: 912, end: 998 };
}

async function main() {
  const members = await prisma.member.findMany({ orderBy: [{ rank: "asc" }, { name: "asc" }] });

  const taken = new Set(["911", "999"]);
  const counters: Record<string, number> = {};

  for (const m of members) {
    const range = getCallSignRange(m.rank);
    const prefix = `${range.start}-${range.end}`;
    if (!(prefix in counters)) counters[prefix] = range.start;

    let callsign: string | null = null;
    while (counters[prefix] <= range.end) {
      const cs = String(counters[prefix]);
      counters[prefix]++;
      if (!taken.has(cs)) {
        callsign = cs;
        break;
      }
    }

    if (callsign) {
      await prisma.member.update({
        where: { id: m.id },
        data: { callSign: callsign },
      });
      console.log(`  ${m.name} (${m.rank}) → ${callsign}`);
    } else {
      console.log(`  ${m.name} (${m.rank}) → no available call sign in range!`);
    }
  }
}

main()
  .catch((e) => { console.error("Failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
