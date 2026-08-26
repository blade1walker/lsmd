import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (isDenied(auth)) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json({ error: "memberId required" }, { status: 400 });
    }

    const activeEntry = await prisma.clockEntry.findFirst({
      where: {
        memberId,
        clockOutAt: null,
      },
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEntries = await prisma.clockEntry.findMany({
      where: {
        memberId,
        clockInAt: { gte: todayStart },
      },
    });

    const todayTotal = todayEntries.reduce(
      (sum, e) => sum + (e.durationSec ?? 0),
      0
    );

    return NextResponse.json({
      isClockedIn: !!activeEntry,
      entryId: activeEntry?.id ?? null,
      clockInAt: activeEntry?.clockInAt ?? null,
      todayTotal,
    });
  } catch (error) {
    console.error("Error getting clock status:", error);
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 });
  }
}
