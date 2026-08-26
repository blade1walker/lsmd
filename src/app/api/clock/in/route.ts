import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, hasPermission } from "@/lib/api-auth";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (isDenied(auth)) return auth.error;

  try {
    const body = await request.json();
    const { memberId } = body;

    // memberId arrives in the body, so without this check any signed-in user
    // could clock any member in and falsify their activity hours.
    if (auth.access.memberId !== memberId && !hasPermission(auth.access, "clock.view")) {
      return NextResponse.json({ error: "Cannot clock in for another member" }, { status: 403 });
    }

    const existingEntry = await prisma.clockEntry.findFirst({
      where: {
        memberId,
        clockOutAt: null,
      },
    });

    if (existingEntry) {
      return NextResponse.json({ error: "Already clocked in" }, { status: 400 });
    }

    const entry = await prisma.clockEntry.create({
      data: {
        memberId,
        clockInAt: new Date(),
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Error clocking in:", error);
    return NextResponse.json({ error: "Failed to clock in" }, { status: 500 });
  }
}
