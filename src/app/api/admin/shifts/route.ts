import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

export async function GET() {
  const auth = await requireAuth("shifts.view");
  if (isDenied(auth)) return auth.error;

  try {
    const shifts = await prisma.shift.findMany({
      include: {
        assignments: {
          include: { member: { select: { id: true, name: true, callSign: true, rank: true } } },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(shifts);
  } catch (error) {
    return apiError("Failed to fetch shifts", error);
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth("shifts.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await request.json();
    const { name, startTime, endTime, days, color } = body;

    const shift = await prisma.shift.create({
      data: { name, startTime, endTime, days, color },
    });

    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    return apiError("Failed to create shift", error);
  }
}
