import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
