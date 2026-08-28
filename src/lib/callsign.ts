import { prisma } from "./prisma";
import { CALLSIGN_FLOOR, CALLSIGN_CEILING, CALLSIGN_MAX } from "./constants";

/**
 * The lowest unused call sign in the allocatable range, so numbers freed by
 * departures return to the pool instead of the sequence only ever climbing.
 * If 912-998 is entirely taken, continues above the reserved block rather
 * than leaving a member unassigned — never returns a reserved number.
 */
export async function getNextCallSign(): Promise<string> {
  const used = await prisma.member.findMany({
    where: { callSign: { not: null } },
    select: { callSign: true },
  });
  const usedSet = new Set(used.map((m) => m.callSign));

  for (let i = CALLSIGN_FLOOR; i <= CALLSIGN_CEILING; i++) {
    const cs = String(i);
    if (!usedSet.has(cs)) return cs;
  }

  for (let i = CALLSIGN_MAX + 1; ; i++) {
    const cs = String(i);
    if (!usedSet.has(cs)) return cs;
  }
}
