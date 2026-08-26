import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

export async function GET() {
  const auth = await requireAuth("roster.view");
  if (isDenied(auth)) return auth.error;

  try {
    const [
      totalMembers,
      activeMembers,
      reserveMembers,
      loaMembers,
      pendingLOAs,
      pendingRemovals,
      pendingInactivity,
      pendingOnboarding,
      pendingFTP,
      pendingRecruits,
      totalClockEntries,
      recentPromotions,
      membersByRank,
      membersByActivity,
    ] = await Promise.all([
      prisma.member.count(),
      prisma.member.count({ where: { activity: "Active" } }),
      prisma.member.count({ where: { activity: "Reserve" } }),
      prisma.member.count({ where: { activity: "LOA" } }),
      prisma.lOA.count({ where: { status: "Pending" } }),
      prisma.removalRequest.count({ where: { status: "Pending" } }),
      prisma.inactivityRequest.count({ where: { status: "Pending" } }),
      prisma.onboardingRequest.count({ where: { status: "Pending" } }),
      prisma.fTPRequest.count({ where: { status: "Pending" } }),
      prisma.recruitRequest.count({ where: { status: "Pending" } }),
      prisma.clockEntry.count(),
      prisma.promotionNotification.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          memberName: true,
          callSign: true,
          fromRank: true,
          toRank: true,
          promotedBy: true,
          createdAt: true,
        },
      }),
      prisma.member.groupBy({
        by: ["rank"],
        _count: true,
        orderBy: { _count: { rank: "desc" } },
      }),
      prisma.member.groupBy({
        by: ["activity"],
        _count: true,
      }),
    ]);

    const totalPending =
      pendingLOAs + pendingRemovals + pendingInactivity + pendingOnboarding + pendingFTP + pendingRecruits;

    const topClockHours = await prisma.clockEntry.groupBy({
      by: ["memberId"],
      _sum: { durationSec: true },
      orderBy: { _sum: { durationSec: "desc" } },
      take: 5,
    });

    const memberIds = topClockHours.map((e) => e.memberId);
    const clockMembers = await prisma.member.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, name: true, callSign: true },
    });
    const memberMap = new Map(clockMembers.map((m) => [m.id, m]));

    const topClockers = topClockHours
      .map((entry) => ({
        member: memberMap.get(entry.memberId),
        hours: Math.round((entry._sum.durationSec ?? 0) / 3600 * 10) / 10,
      }))
      .filter((e) => e.member);

    return NextResponse.json({
      stats: {
        totalMembers,
        activeMembers,
        reserveMembers,
        loaMembers,
        totalPending,
        totalClockEntries,
        pendingBreakdown: {
          loas: pendingLOAs,
          removals: pendingRemovals,
          inactivity: pendingInactivity,
          onboarding: pendingOnboarding,
          ftp: pendingFTP,
          recruits: pendingRecruits,
        },
      },
      recentPromotions,
      membersByRank: membersByRank.map((r) => ({ rank: r.rank, count: r._count })),
      membersByActivity: membersByActivity.map((a) => ({ activity: a.activity, count: a._count })),
      topClockers,
    });
  } catch (error) {
      return apiError("Failed to fetch dashboard data", error);
  }
}
