import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { memberId } = body;

    const entry = await prisma.clockEntry.findFirst({
      where: {
        memberId,
        clockOutAt: null,
      },
    });

    if (!entry) {
      return NextResponse.json({ error: "Not clocked in" }, { status: 400 });
    }

    const clockOutAt = new Date();
    const durationSec = Math.floor(
      (clockOutAt.getTime() - entry.clockInAt.getTime()) / 1000
    );

    const updated = await prisma.clockEntry.update({
      where: { id: entry.id },
      data: {
        clockOutAt,
        durationSec,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error clocking out:", error);
    return NextResponse.json({ error: "Failed to clock out" }, { status: 500 });
  }
}
