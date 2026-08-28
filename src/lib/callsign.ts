import { prisma } from "./prisma";
import { RANK_CALLSIGN } from "./constants";

export async function getNextCallSign(rank: string): Promise<string | null> {
  const range = RANK_CALLSIGN[rank];
  if (!range) return null;

  if (range.fixed) {
    const existing = await prisma.member.findFirst({ where: { callSign: String(range.fixed) } });
    if (!existing) return String(range.fixed);
    return null;
  }

  if (range.start && range.end) {
    const used = await prisma.member.findMany({
      where: { callSign: { not: null } },
      select: { callSign: true },
    });
    const usedSet = new Set(used.map((m) => m.callSign));

    for (let i = range.start; i <= range.end; i++) {
      const cs = String(i);
      if (!usedSet.has(cs)) return cs;
    }

    // The rank's own band is full. Rather than leaving the member without a
    // call sign, keep counting past the highest number any rank reserves
    // (fixed or ranged) so an overflow assignment can never collide with
    // another rank's number.
    const reservedMax = Object.values(RANK_CALLSIGN).reduce(
      (max, r) => Math.max(max, r.fixed ?? 0, r.end ?? 0),
      0
    );
    for (let i = reservedMax + 1; ; i++) {
      const cs = String(i);
      if (!usedSet.has(cs)) return cs;
    }
  }

  return null;
}
