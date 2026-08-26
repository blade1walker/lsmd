import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

export async function POST(request: Request) {
  const auth = await requireAuth("shifts.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const { shiftId, memberId, date } = await request.json();

    const assignment = await prisma.shiftAssignment.create({
      data: {
        shiftId,
        memberId,
        date: new Date(date),
      },
      include: { member: { select: { id: true, name: true, callSign: true } } },
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Member already assigned to this shift on this date" }, { status: 409 });
    }
    return apiError("Failed to assign member", error);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuth("shifts.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const { shiftId, memberId, date } = await request.json();

    await prisma.shiftAssignment.deleteMany({
      where: {
        shiftId,
        memberId,
        date: new Date(date),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Failed to remove assignment", error);
  }
}
