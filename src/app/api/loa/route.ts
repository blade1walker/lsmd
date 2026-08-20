import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const loas = await prisma.lOA.findMany({
      include: {
        member: {
          select: { name: true, callSign: true, rank: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(loas);
  } catch (error) {
    console.error("Error fetching LOAs:", error);
    return NextResponse.json({ error: "Failed to fetch LOAs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { memberId, reason, startDate, endDate, notes, createdBy } = body;

    const loa = await prisma.lOA.create({
      data: {
        memberId,
        reason,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        notes,
        createdBy,
      },
    });

    await prisma.member.update({
      where: { id: memberId },
      data: { activity: "LOA" },
    });

    return NextResponse.json(loa, { status: 201 });
  } catch (error) {
    console.error("Error creating LOA:", error);
    return NextResponse.json({ error: "Failed to create LOA" }, { status: 500 });
  }
}
