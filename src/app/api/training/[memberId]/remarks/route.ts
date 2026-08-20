import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const body = await request.json();
    const { authorCallSign, authorRole, content } = body;

    const remark = await prisma.remark.create({
      data: {
        trainingRecordId: memberId,
        authorCallSign,
        authorRole,
        content,
      },
    });

    return NextResponse.json(remark, { status: 201 });
  } catch (error) {
    console.error("Error adding remark:", error);
    return NextResponse.json({ error: "Failed to add remark" }, { status: 500 });
  }
}
