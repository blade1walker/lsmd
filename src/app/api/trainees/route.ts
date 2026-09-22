import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { TRAINEE_RANKS } from "@/lib/constants";
import { daysSince } from "@/lib/trainees";

/**
 * The Trainee Section. Read straight off the roster on every request rather
 * than kept as its own list, so there is no second copy of a member to go
 * stale: change a trainee's rank on the roster and they are gone from here on
 * the next load.
 */
export async function GET() {
  const auth = await requireAuth("trainees.view");
  if (isDenied(auth)) return auth.error;

  try {
    const members = await prisma.member.findMany({
      where: { rank: { in: TRAINEE_RANKS } },
      select: {
        id: true,
        name: true,
        callSign: true,
        rank: true,
        activity: true,
        dateOfJoining: true,
        createdAt: true,
      },
    });

    const now = new Date();
    const trainees = members
      .map((m) => {
        // A member added without a joining date still has a start: the day
        // their roster row was created.
        const startDate = m.dateOfJoining ?? m.createdAt;
        return {
          id: m.id,
          name: m.name,
          callSign: m.callSign,
          rank: m.rank,
          activity: m.activity,
          startDate: startDate.toISOString(),
          startDateEstimated: !m.dateOfJoining,
          daysInDepartment: daysSince(startDate, now),
        };
      })
      .sort((a, b) => b.daysInDepartment - a.daysInDepartment || a.name.localeCompare(b.name));

    return NextResponse.json(trainees);
  } catch (error) {
    return apiError("Failed to load trainees", error);
  }
}
