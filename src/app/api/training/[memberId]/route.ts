import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;

    let record = await prisma.trainingRecord.findUnique({
      where: { memberId },
      include: {
        remarks: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!record) {
      record = await prisma.trainingRecord.create({
        data: { memberId },
        include: {
          remarks: true,
        },
      });
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error("Error fetching training record:", error);
    return NextResponse.json({ error: "Failed to fetch record" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const body = await request.json();

    const record = await prisma.trainingRecord.upsert({
      where: { memberId },
      update: body,
      create: {
        memberId,
        ...body,
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error("Error updating training record:", error);
    return NextResponse.json({ error: "Failed to update record" }, { status: 500 });
  }
}
