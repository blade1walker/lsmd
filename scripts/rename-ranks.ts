import "dotenv/config";
import { createPrismaClient } from "../src/lib/prisma";

/**
 * Moves records from a retired rank name to its new one, so renaming a rank
 * in RANKS (src/lib/constants.ts) does not strand the members on it.
 *
 * Only fields that hold a rank in effect now are moved: roster ranks, rank
 * gates, and requests or interviews still in progress. Records of what
 * happened (promotion history, removal requests, signed documents) keep the
 * name they were made under. Safe on every deploy: once nothing is left on
 * an old name it changes nothing. Run by scripts/deploy-schema.mjs; by hand
 * with `npm run db:rename-ranks`.
 */
const RENAMES: Record<string, string> = {
  // 2026-10-28: Medical Director added above it.
  "Director of Medicine": "Director of EMS",
};

const prisma = createPrismaClient();

async function main() {
  for (const [from, to] of Object.entries(RENAMES)) {
    const results = await prisma.$transaction([
      prisma.member.updateMany({ where: { rank: from }, data: { rank: to } }),
      prisma.member.updateMany({ where: { tempRank: from }, data: { tempRank: to } }),
      prisma.test.updateMany({ where: { minRank: from }, data: { minRank: to } }),
      prisma.departmentTemplate.updateMany({ where: { minRank: from }, data: { minRank: to } }),
      prisma.onboardingRequest.updateMany({ where: { assignedRank: from }, data: { assignedRank: to } }),
      prisma.recruitRequest.updateMany({ where: { rank: from }, data: { rank: to } }),
      prisma.promotionInterview.updateMany({ where: { currentRank: from }, data: { currentRank: to } }),
      // The default 2 s to open a transaction is less than one connection to
      // the database takes from a far-away host (Oracle in Mumbai → Neon in the US).
    ], { maxWait: 15_000, timeout: 30_000 });
    const moved = results.reduce((sum, r) => sum + r.count, 0);
    if (moved) console.log(`[rename-ranks] "${from}" -> "${to}": ${moved} record(s) updated.`);
  }
}

main()
  .catch((error) => {
    console.error("[rename-ranks] Failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
