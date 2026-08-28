import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getRankWeight } from "../src/lib/constants";

/**
 * One-time renumber: replaces every member's call sign with a single
 * roster-wide sequence starting at 912, highest rank first (then current
 * roster order within the same rank). Call signs no longer carry any
 * rank-specific meaning — see src/lib/callsign.ts, which allocates the lowest
 * free number in this same pool for new members going forward.
 *
 * Dry-run by default — prints the full before/after plan without writing
 * anything. Pass --apply to actually save it.
 */

const CALLSIGN_FLOOR = 912;
const CALLSIGN_CEILING = 998;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env or export it, then re-run.");
  process.exit(1);
}

const apply = process.argv.includes("--apply");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const members = await prisma.member.findMany({
    orderBy: { order: "asc" },
    select: { id: true, name: true, rank: true, callSign: true },
  });

  // Array.prototype.sort is stable, so members tied on rank weight keep
  // their current roster order relative to each other.
  const ranked = [...members].sort((a, b) => getRankWeight(b.rank) - getRankWeight(a.rank));

  const plan = ranked.map((m, i) => ({ ...m, newCallSign: String(CALLSIGN_FLOOR + i) }));
  const changed = plan.filter((p) => p.callSign !== p.newCallSign);

  console.log(
    `${apply ? "APPLYING" : "DRY RUN (pass --apply to write)"} — renumbering ${plan.length} members starting at ${CALLSIGN_FLOOR}\n`
  );

  for (const p of plan) {
    const isChanged = p.callSign !== p.newCallSign;
    console.log(
      `  ${isChanged ? "->" : "  "} ${p.newCallSign.padStart(4)}  ${p.rank.padEnd(20)} ${p.name}` +
        (isChanged ? `   (was ${p.callSign ?? "none"})` : "")
    );
  }

  console.log(`\n${changed.length} of ${plan.length} call signs will change; ${plan.length - changed.length} already match.`);

  const overflow = plan.filter((p) => Number(p.newCallSign) > CALLSIGN_CEILING);
  if (overflow.length > 0) {
    console.log(
      `\nWARNING: the roster has ${plan.length} members but the ${CALLSIGN_FLOOR}-${CALLSIGN_CEILING} pool only holds ${CALLSIGN_CEILING - CALLSIGN_FLOOR + 1}.`
    );
    console.log(`${overflow.length} member(s) would be numbered above ${CALLSIGN_CEILING}.`);
  }

  if (!apply) {
    console.log("\nNothing written. Re-run with --apply to save these call signs.");
    return;
  }

  for (const p of changed) {
    await prisma.member.update({ where: { id: p.id }, data: { callSign: p.newCallSign } });
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
