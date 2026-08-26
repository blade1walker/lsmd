import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireAuth("clock.view");
  if (isDenied(auth)) return auth.error;

  try {
    const members = await prisma.member.findMany({
      select: {
        id: true,
        name: true,
        callSign: true,
        clockEntries: {
          select: {
            durationSec: true,
          },
        },
      },
    });

    const totals = members.map((member) => ({
      id: member.id,
      name: member.name,
      callSign: member.callSign,
      totalSeconds: member.clockEntries.reduce(
        (sum, e) => sum + (e.durationSec ?? 0),
        0
      ),
    }));

    totals.sort((a, b) => b.totalSeconds - a.totalSeconds);

    return NextResponse.json(totals);
  } catch (error) {
    console.error("Error fetching clock totals:", error);
    return NextResponse.json({ error: "Failed to fetch totals" }, { status: 500 });
  }
}
