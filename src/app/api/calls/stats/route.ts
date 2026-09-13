import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { CALL_SECTION_PERMISSIONS } from "@/lib/constants";
import { TRANSPORT_OUTCOME, type CallStats } from "@/lib/calls";
import { ownCallsFilter } from "@/lib/calls-server";
import type { Prisma } from "@/generated/prisma/client";

const DAY_MS = 86_400_000;

/**
 * Call Log statistics. Counts carry no patient data, but they are scoped the
 * same way as the log itself — a medic without calls.view sees figures for
 * their own calls, not the department's.
 */
export async function GET() {
  const auth = await requireAuth(CALL_SECTION_PERMISSIONS);
  if (isDenied(auth)) return auth.error;

  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const since7 = new Date(now.getTime() - 7 * DAY_MS);
    const since30 = new Date(now.getTime() - 30 * DAY_MS);

    const scope = ownCallsFilter(auth.access);
    const within = (gte: Date): Prisma.EmsCallWhereInput =>
      scope ? { AND: [scope, { occurredAt: { gte } }] } : { occurredAt: { gte } };

    const [today, last7Days, last30Days, byNature, byOutcome, topResponders] = await Promise.all([
      prisma.emsCall.count({ where: within(startOfToday) }),
      prisma.emsCall.count({ where: within(since7) }),
      prisma.emsCall.count({ where: within(since30) }),
      prisma.emsCall.groupBy({
        by: ["nature"],
        where: within(since30),
        _count: { _all: true },
        orderBy: { _count: { nature: "desc" } },
        take: 6,
      }),
      prisma.emsCall.groupBy({
        by: ["outcome"],
        where: within(since30),
        _count: { _all: true },
        orderBy: { _count: { outcome: "desc" } },
      }),
      prisma.emsCallResponder.groupBy({
        by: ["memberId"],
        where: { call: within(since30) },
        _count: { _all: true },
        orderBy: { _count: { memberId: "desc" } },
        take: 5,
      }),
    ]);

    const members = await prisma.member.findMany({
      where: { id: { in: topResponders.map((r) => r.memberId) } },
      select: { id: true, name: true, callSign: true },
    });
    const byId = new Map(members.map((m) => [m.id, m]));

    const transported = byOutcome.find((o) => o.outcome === TRANSPORT_OUTCOME)?._count._all ?? 0;

    const stats: CallStats = {
      today,
      last7Days,
      last30Days,
      transportRate: last30Days ? Math.round((transported / last30Days) * 100) : 0,
      byNature: byNature.map((n) => ({ nature: n.nature, count: n._count._all })),
      byOutcome: byOutcome.map((o) => ({ outcome: o.outcome, count: o._count._all })),
      topResponders: topResponders.flatMap((r) => {
        const member = byId.get(r.memberId);
        return member ? [{ memberId: r.memberId, name: member.name, callSign: member.callSign, count: r._count._all }] : [];
      }),
      departmentWide: scope === null,
    };

    return NextResponse.json(stats);
  } catch (error) {
    return apiError("Failed to load call statistics", error);
  }
}
