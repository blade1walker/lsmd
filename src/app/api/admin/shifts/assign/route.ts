import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
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
  } catch (error: any) {
    console.error("Error assigning member:", error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Member already assigned to this shift on this date" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to assign member" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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
    console.error("Error removing assignment:", error);
    return NextResponse.json({ error: "Failed to remove assignment" }, { status: 500 });
  }
}
