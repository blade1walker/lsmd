import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getRankWeight } from "../src/lib/constants";

/**
 * Copies promotions recorded before Promotion History existed into it.
 *
 * Every promotion since the roster started announcing them left a
 * PromotionNotification row, so those are the history up to now. Each copy
 * carries the notification's id in legacyNotificationId, so re-running this
 * skips rows it already copied instead of duplicating them.
 */
const prisma = (() => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
})();

async function main() {
  const [notifications, copied] = await Promise.all([
    prisma.promotionNotification.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.promotionRecord.findMany({
      where: { legacyNotificationId: { not: null } },
      select: { legacyNotificationId: true },
    }),
  ]);
  const done = new Set(copied.map((r) => r.legacyNotificationId));

  let created = 0;
  for (const n of notifications) {
    if (done.has(n.id)) continue;
    await prisma.promotionRecord.create({
      data: {
        memberId: n.memberId,
        memberName: n.memberName,
        callSign: n.callSign,
        fromRank: n.fromRank,
        toRank: n.toRank,
        direction: getRankWeight(n.toRank) > getRankWeight(n.fromRank) ? "Promotion" : "Demotion",
        promotedBy: n.promotedBy,
        promotedAt: n.createdAt,
        legacyNotificationId: n.id,
      },
    });
    created++;
  }

  console.log(`Copied ${created} promotion(s); ${notifications.length - created} were already in the history.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
